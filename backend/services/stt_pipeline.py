# backend/services/stt_pipeline.py

import asyncio
import logging
import wave
import os
import contextlib
from datetime import datetime
import time

from backend.ml.stt_model import STTModel
from backend.ml.vad import VADFilter
from backend.ml.postprocess.silence_segmenter import SilenceSegmenter
from backend.ml.postprocess.timestamp_deduplicator import TimestampDeduplicator
from backend.ml.summarizer import ThreeLineSummarizer
from backend.config import VAD_THRESHOLD, VAD_SAMPLE_RATE

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("STTPipeline")


class STTPipeline:
    """
    실시간 STT 파이프라인
    - 1분 단위 구간 요약: [last_cut_ts, now) 범위의 확정문장 + 라이브 버퍼로 요약
    - 비동기 요약: summarizer.generate를 별 스레드에서 실행하여 이벤트 루프 블로킹 방지
    - 세션 종료 시 마지막 구간 강제 flush
    """
    def __init__(self):
        # === 모델 초기화 ===
        self.stt = STTModel(
            "small",
            device="cuda",
            chunk_seconds=3.0,
            overlap_seconds=1.0,
            sample_rate=VAD_SAMPLE_RATE
        )
        self.vad = VADFilter(threshold=VAD_THRESHOLD, sampling_rate=VAD_SAMPLE_RATE)
        self.deduper = TimestampDeduplicator()
        self.segmenter = SilenceSegmenter(silence_limit=1.5, chunk_seconds=1.0, ngram_size=2)
        self.summarizer = ThreeLineSummarizer(device="cuda")

        # ===== 요약/세션 상태 =====
        self.summary_task = None           # asyncio.Task | None
        self.session_active = False
        self.ws = None                     # WebSocket | None
        self.session_start_ts = None       # float | None
        self.last_cut_ts = None            # float | None
        self._tick_interval = 1.0          # 초
        self._min_chars_for_summary = 40   # 요약 최소 분량 (부족하면 다음 구간으로 합산)
        # 참고: 너무 낮추면 빈약한 요약이 나올 수 있음. 필요시 60~120으로 조정.

        # ===== 텍스트/오디오 버퍼 =====
        # 확정 문장 히스토리: (확정시각 timestamp, text) 리스트
        self.paragraph_buffer = []         # list[tuple[float, str]]
        # 웹소켓 세션 동안 수신한 원본 PCM
        self.raw_audio_buffer = bytearray()

        # 저장 이력
        self.last_saved_file = None
        self.last_saved_duration = None

    # ---------------------------------------------------------------------
    # 세션 수명주기 (선택적)
    # main.py에서 await pipeline.begin_session(websocket) / await pipeline.end_session()
    # 을 호출하면 오디오가 들어오기 전에도 타이머가 바로 시작된다.
    # main을 수정하기 어렵다면 호출하지 않아도 되며, 첫 feed() 시 자동 초기화된다.
    # ---------------------------------------------------------------------
    async def begin_session(self, websocket):
        """WS 수락 직후 호출: 타이머 즉시 시작(오디오 유무 무관)."""
        if self.session_active:
            return
        self.ws = websocket
        self.session_active = True
        now = time.time()
        self.session_start_ts = now
        self.last_cut_ts = now
        if self.summary_task is None or self.summary_task.done():
            self.summary_task = asyncio.create_task(self._summary_loop())
        logger.info("🟢 Session begun: summary loop started.")

    async def end_session(self):
        """WS 종료 직전 호출: 마지막 구간 요약 flush & 타이머 종료."""
        try:
            await self._flush_interval_summary(force=True)
        except Exception as e:
            logger.warning(f"flush on end_session failed: {e}")

        if self.summary_task and not self.summary_task.done():
            self.summary_task.cancel()
            try:
                await self.summary_task
            except asyncio.CancelledError:
                pass
        self.summary_task = None

        self.session_active = False
        self.ws = None
        logger.info("🔴 Session ended: summary loop stopped.")

    # ---------------------------------------------------------------------
    # 내부 타이머 루프 & 요약 로직
    # ---------------------------------------------------------------------
    async def _summary_loop(self):
        """1초마다 체크, 60초 경과 시 [last_cut_ts, now) 구간 요약."""
        try:
            while True:
                await asyncio.sleep(self._tick_interval)
                if not self.session_active or self.ws is None:
                    continue
                now = time.time()
                if self.last_cut_ts is None:
                    self.last_cut_ts = now
                # 60초 경과 시점에만 구간 요약
                if now - self.last_cut_ts >= 60.0:
                    await self._flush_interval_summary(force=False)
        except asyncio.CancelledError:
            logger.info("Summary loop cancelled.")

    def _collect_text_in_interval(self, start_ts: float, end_ts: float) -> str:
        """
        start~end 사이의 확정 문장 + (옵션) 현재 진행중 라이브 버퍼를 합친 텍스트.
        - 화자가 계속 말하고 있어 무음 확정이 안 되어도 라이브 버퍼를 포함하여 요약 가능.
        """
        # 1) 확정 문장 필터
        texts = [t for (ts, t) in self.paragraph_buffer if start_ts <= ts < end_ts]

        # 2) 라이브 버퍼(현재 segmenter에 남은 진행중 텍스트)
        live = self.segmenter.buffer.strip()
        if live:
            texts.append(live)

        return " ".join(texts).strip()

    async def _flush_interval_summary(self, force: bool):
        """
        마지막 컷(last_cut_ts)부터 지금(now)까지의 구간을 요약 후 push.
        force=False: 최소 분량 미달이면 스킵(다음 구간으로 누적)
        force=True : 분량과 무관하게 시도(세션 종료용)
        """
        if self.ws is None:
            return
        now = time.time()
        if self.last_cut_ts is None:
            self.last_cut_ts = now

        source_text = self._collect_text_in_interval(self.last_cut_ts, now)

        if not force and len(source_text) < self._min_chars_for_summary:
            # 분량 부족 → 컷은 그대로 두고 다음 구간에 누적
            logger.debug("⏭️ Interval too short, carry over to next minute.")
            return

        if not source_text:
            # 완전 비었으면 컷만 전진
            self.last_cut_ts = now
            return

        # 요약은 별 스레드에서 실행(이벤트 루프 블로킹 방지)
        summary = await asyncio.to_thread(self.summarizer.summarize, source_text)

        try:
            await self.ws.send_json({"paragraph": source_text, "summary": summary})
        except Exception as e:
            logger.warning(f"Send summary failed: {e}")

        # 이번 구간 종료 → 컷 이동
        self.last_cut_ts = now

        # 메모리 관리: 이미 포함된 확정 문장 제거
        self.paragraph_buffer = [(ts, t) for (ts, t) in self.paragraph_buffer if ts >= self.last_cut_ts]

        logger.info("🧾 Interval summarized and sent.")

    # ---------------------------------------------------------------------
    # 실시간 feed
    # ---------------------------------------------------------------------
    async def feed(self, data, websocket):
        """
        오디오 data → VAD → STT → Dedup → Segment → WebSocket
        - 첫 호출 시 세션/타이머 자동 초기화(fallback)로 main 수정 없이도 동작.
        """
        # 세션/타이머 자동 초기화 (main에서 begin_session을 안 불렀을 때를 대비)
        if not self.session_active or self.ws is None:
            self.ws = websocket
            self.session_active = True
            now = time.time()
            if self.session_start_ts is None:
                self.session_start_ts = now
            if self.last_cut_ts is None:
                self.last_cut_ts = now
            if self.summary_task is None or self.summary_task.done():
                self.summary_task = asyncio.create_task(self._summary_loop())
            logger.info("🟢 Session auto-begun by first feed().")

        # === 원본 오디오 저장 ===
        self.raw_audio_buffer.extend(data)

        # === 1. VAD 체크 ===
        if not self.vad.has_speech(data):
            live, finalized = self.segmenter.feed(is_silence=True)
            if finalized:
                await websocket.send_json({"append": finalized})
                # 확정 시점 기록
                self.paragraph_buffer.append((time.time(), finalized))
                logger.info(f"Finalized (silence): {finalized}")
            return

        # === 2. STT 실행 (segments 반환) ===
        segments = await asyncio.to_thread(self.stt.feed, data, True)
        if segments is None:
            return

        # === 3. 타임스탬프 Deduplication ===
        raw_text = self.deduper.filter(segments)
        if raw_text is None:
            return

        # === 4. 후처리 ===
        live, finalized = self.segmenter.feed(text=raw_text)

        if live:
            await websocket.send_json({"realtime": live})
            logger.debug(f"Live Buffer: {live}")

        if finalized:
            await websocket.send_json({"append": finalized})
            # 확정 시점 기록
            self.paragraph_buffer.append((time.time(), finalized))
            logger.info(f"Finalized: {finalized}")

        logger.debug(f"Deduped Text: {raw_text}")

    # ---------------------------------------------------------------------
    # 상태 초기화/저장
    # ---------------------------------------------------------------------
    def reset(self):
        """모든 버퍼/상태 초기화 (녹음 저장 후 호출)"""
        self.raw_audio_buffer.clear()
        self.segmenter.buffer = ""
        self.segmenter.silence_time = 0.0
        self.deduper.reset()
        # paragraph_buffer는 **세션 내 구간 요약**에 사용되므로
        # 여기서 비우지 않고, 구간 요약 시 소비/정리한다.
        logger.info("🔄 STT Pipeline 상태 초기화 완료")

    def save_raw_audio(self, folder=None, filename=None):
        """원본 오디오를 WAV 파일로 저장"""
        if not self.raw_audio_buffer:
            logger.warning("No audio data to save.")
            return None

        # backend/services 기준 recordings 경로
        if folder is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))  # backend/services/
            folder = os.path.join(base_dir, "..", "recordings")    # backend/recordings
            folder = os.path.normpath(folder)
        os.makedirs(folder, exist_ok=True)

        if filename is None:
            filename = datetime.now().strftime("%Y%m%d_%H%M%S_%f_meeting.wav")

        filepath = os.path.join(folder, filename)

        with wave.open(filepath, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(VAD_SAMPLE_RATE)
            wf.writeframes(memoryview(self.raw_audio_buffer))

        # duration 계산
        with contextlib.closing(wave.open(filepath, 'r')) as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            duration = frames / float(rate)

        logger.info(f"Audio saved at: {filepath} (duration={duration:.2f}s)")

        self.last_saved_file = filepath
        self.last_saved_duration = duration
        self.reset()

        return {"filepath": filepath, "duration": duration}
