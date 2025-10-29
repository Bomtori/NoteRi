# backend/services/stt_pipeline.py

import asyncio
import logging
import wave
import os
import contextlib
from datetime import datetime
import time
from uuid import uuid4
from datetime import datetime
import traceback
from starlette.websockets import WebSocketState

from backend.ml.stt_model import STTModel
from backend.ml.vad import VADFilter
from backend.ml.postprocess.silence_segmenter import SilenceSegmenter
from backend.ml.postprocess.timestamp_deduplicator import TimestampDeduplicator
from backend.ml.summarizer import ThreeLineSummarizer
from backend.config import VAD_THRESHOLD, VAD_SAMPLE_RATE
from backend.services.diarization import run_diarization_for_session
from backend.ml.postprocess.text_cleaner import normalize_transcript_lines, TextCleaner
from backend.app.tasks.final_summary import (
    build_final_summary_from_lines,
    persist_final_summary,
    fetch_lines_from_db,
)

# ✅ Redis 퍼블리셔 (요구사항 반영: session_id 필드 미사용, raw_text/speaker_label 사용)
from backend.app.util.redis_publisher import (
    init_session_meta, end_session_meta,
    publish_segment, publish_summary
)
from backend.app.tasks.redis_to_pg import ingest_one_session

def _short_sid() -> str:
    """8자리 짧은 SID (예: 'a1b2c3d4')"""
    return uuid4().hex[:8]

def _date_prefix() -> str:
    # 날짜 기반 네임스페이스(예: stt:2025-10-20)
    return datetime.now().strftime("stt:%Y-%m-%d")


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

        # ===== 텍스트/오디오 버퍼 =====
        # 확정 문장 히스토리: (확정시각 timestamp, text) 리스트
        self.paragraph_buffer = []         # list[tuple[float, str]]
        # 웹소켓 세션 동안 수신한 원본 PCM
        self.raw_audio_buffer = bytearray()

        # 저장 이력
        self.last_saved_file = None
        self.last_saved_duration = None

        # ✅ 짧은 세션 식별자 (Redis 키 네임스페이스 전용. 엔트리 필드에는 넣지 않음)
        self.sid: str | None = None
        self.redis_prefix: str | None = None  # 'stt:YYYY-MM-DD' (세션 시작 시 고정)

        # ----- 현재 발화 구간 추적용 (STT 토막들의 최소/최대 시간, 단위: 초)
        self._utt_min_start: float | None = None
        self._utt_max_end: float | None = None

    # ---------------------------------------------------------------------
    # 세션 수명주기 (선택적)
    # main.py에서 await pipeline.begin_session(websocket) / await pipeline.end_session()
    # 을 호출하면 오디오가 들어오기 전에도 타이머가 바로 시작된다.
    # main을 수정하기 어렵다면 호출하지 않아도 되며, 첫 feed() 시 자동 초기화된다.
    # ---------------------------------------------------------------------
    async def _start_session(self, websocket, *, source: str):
        """공통 세션 시작 로직(수동/자동 진입점 통합)."""
        if self.session_active:
            return
        self.ws = websocket
        query_sid = websocket.query_params.get("sid") if hasattr(websocket, "query_params") else None
        self.sid = (query_sid[:12] if query_sid else None) or self.sid or _short_sid()
        # 날짜 prefix 고정(세션 동안 유지)
        self.redis_prefix = datetime.now().strftime("stt:%Y-%m-%d")

        self.session_active = True
        now = time.time()
        self.session_start_ts = now
        self.last_cut_ts = now
        if self.summary_task is None or self.summary_task.done():
            self.summary_task = asyncio.create_task(self._summary_loop())

        # 메타 시작 기록(날짜 prefix 적용). stt_model 필드 제거됨.
        try:
            await init_session_meta(
                sid=self.sid,
                prefix=self.redis_prefix,
                sample_rate=VAD_SAMPLE_RATE,
                vad_threshold=VAD_THRESHOLD,
                source=source,  # 메타 필드로 남겨 디버깅 편의
            )
        except Exception as e:
            logger.warning(f"init_session_meta({source}) failed: {e}")

        # ✅ 프론트가 “이번 세션”을 정확히 추적할 수 있도록 SID 알림
        await self._safe_send_json({"event": "session_started", "sid": self.sid})

    async def begin_session(self, websocket):
        """WS 수락 직후 호출: 타이머 즉시 시작(오디오 유무 무관)."""
        await self._start_session(websocket, source="manual")
        logger.info(f"🟢 Session begun: sid={self.sid}, summary loop started. (manual)")

    async def end_session(self, run_diarization: bool = True):
        """WS 종료 직전 호출: 마지막 구간 요약 flush & 타이머 종료."""
        try:
            # flush_final_summary는 websocket 쪽에서 이미 실행함 → 제거
            pass
        except Exception:
            pass

        # ✅ Redis 메타 종료
        if self.sid:
            try:
                await end_session_meta(self.sid, prefix=self.redis_prefix)
            except Exception as e:
                logger.warning(f"end_session_meta failed: {e}")

        # ✅ 요약 task 중단
        if self.summary_task and not self.summary_task.done():
            self.summary_task.cancel()
            try:
                await self.summary_task
            except asyncio.CancelledError:
                pass
        self.summary_task = None

        # ✅ (1) 최종 요약에 쓸 라인들 **먼저 복사**해둠 (reset_all 전에!)
        all_lines_for_final: list[str] = []

        # 🔥 FIX: 튜플 (timestamp, text)에서 text만 추출
        for ts, text in getattr(self, "paragraph_buffer", []):
            if text and text.strip():
                all_lines_for_final.append(text.strip())

        # segmenter 버퍼도 추가
        seg = getattr(self, "segmenter", None)
        if seg and getattr(seg, "buffer", ""):
            buffer_text = seg.buffer.strip()
            if buffer_text:
                all_lines_for_final.append(buffer_text)

        self.session_active = False
        self.ws = None
        logger.info("🔴 Session ended: summary loop stopped.")
        self.reset_all()

        # ✅ Redis → Postgres 적재 (to_thread로 블로킹 방지)
        session_id = None
        if self.sid and self.redis_prefix:
            try:
                session_id = await asyncio.to_thread(
                    ingest_one_session, self.redis_prefix, self.sid
                )
                self.last_session_id = session_id

                # Redis 캐시 (한 번만!)
                from backend.app.util.redis_client import get_redis
                r = await get_redis()
                await r.setex(f"stt:last_session_id:{self.sid}", 3600, str(session_id))

                logger.info(f"[DB] Ingest done. sid={self.sid}, session_id={session_id}")
            except Exception as e:
                logger.warning(f"[DB] ingest failed for sid={self.sid}: {e}")

        # ✅ 화자분리는 run_diarization=False일 때는 건너뜀
        if run_diarization and session_id:
            try:
                asyncio.create_task(run_diarization_for_session(session_id))
                logger.info(f"🗣️ Diarization started for session_id={session_id}")
            except Exception as e:
                logger.warning(f"diarization failed: {e}")

        # ✅ (2) ingest로 session_id가 확보되면 → 복사해둔 라인으로 최종 요약 생성/저장
        try:
            if not session_id:
                logger.info("🧾 Final summary skipped (no session_id).")
                return

            # 2-1) 메모리 라인이 없으면 DB에서 대체 소스 확보
            lines = all_lines_for_final
            if not lines:
                lines = await asyncio.to_thread(fetch_lines_from_db, session_id)

            if not lines:
                logger.info("🧾 Final summary skipped (no lines from memory/DB).")
                return

            # 2-2) 요약 생성 + 저장
            final_json = await build_final_summary_from_lines(lines)
            raw_text = "\n".join([ln for ln in lines if ln and ln.strip()])
            
            # 🔥 FIX: persist_final_summary는 동기 함수이므로 to_thread 사용
            await asyncio.to_thread(
                persist_final_summary,
                recording_session_id=session_id,
                summary_json=final_json,
                raw_text=raw_text
            )
            logger.info("🧾 Final summary created and saved.")
        except Exception as e:
            logger.error(f"Final summary failed: {e}")
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            logger.error(f"lines type: {type(lines)}, lines sample: {lines[:2] if lines else 'empty'}")
    # ---------------------------------------------------------------------
    # 내부 타이머 루프 & 요약 로직
    # ---------------------------------------------------------------------
    async def _summary_loop(self):
        """1초마다 체크, 정확히 60초 간격으로 [last_cut_ts, now) 구간 요약."""
        try:
            next_deadline = (self.last_cut_ts or time.time()) + 60.0
            while True:
                await asyncio.sleep(self._tick_interval)
                if not self.session_active or self.ws is None:
                    continue
                now = time.time()
                if now < next_deadline:
                    continue
                # 새 텍스트가 없으면 컷만 전진하여 드리프트 방지
                has_text = bool(self.segmenter.buffer.strip()) or any(
                    ts >= (self.last_cut_ts or 0.0) for ts, _ in self.paragraph_buffer
                )
                if not has_text:
                    self.last_cut_ts = now
                    next_deadline = now + 60.0
                    continue
                await self._flush_interval_summary(force=False)
                next_deadline = (self.last_cut_ts or time.time()) + 60.0
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
        마지막 컷(last_cut_ts)부터 지금(now)까지 요약 후 push.
        force=False: 최소 분량 미달이면 스킵(누적)
        force=True : 분량 무관 시도(세션 종료용)
        """
        if self.ws is None:
            return
        now = time.time()
        if self.last_cut_ts is None:
            self.last_cut_ts = now

        start_ts = self.last_cut_ts
        source_text = self._collect_text_in_interval(start_ts, now)

        if not force and len(source_text) < self._min_chars_for_summary:
            logger.debug("⏭️ Interval too short, carry over to next minute.")
            return
        if not source_text:
            self.last_cut_ts = now
            return

        try:
            summary = await asyncio.to_thread(self.summarizer.summarize, source_text)
        except Exception as e:
            logger.warning(f"summary failed: {e}")
            self.last_cut_ts = now
            return

        await self._safe_send_json({"paragraph": source_text, "summary": summary})

        if self.sid:
            try:
                await publish_summary(
                    sid=self.sid,
                    prefix=self.redis_prefix,
                    interval_start_ms=int(start_ts * 1000),
                    interval_end_ms=int(now * 1000),
                    summary_text=summary,
                )
            except Exception as e:
                logger.warning(f"publish_summary failed: {e}")

        used_until = now
        self.last_cut_ts = used_until
        self.paragraph_buffer = [(ts, t) for (ts, t) in self.paragraph_buffer if ts >= used_until]
        logger.info(f"[{self.sid}] 🧾 Interval summarized and sent.")

    # ---------------------------------------------------------------------
    # 🔸 종료 시 최종 요약 보장을 위한 헬퍼들
    # ---------------------------------------------------------------------
    async def _safe_send_json(self, payload: dict):
        """웹소켓이 살아있을 때만 안전하게 JSON 전송"""
        if self.ws and self.ws.application_state == WebSocketState.CONNECTED:
            try:
                await self.ws.send_json(payload)
            except Exception:
                pass

    async def _force_finalize_live_buffer(self):
        """
        남아있는 실시간 텍스트 버퍼를 무음 주입처럼 강제로 확정시킨다.
        segmenter가 finalize를 반환하면 즉시 WS로 보내고 paragraph_buffer에 적재.
        """
        # 무음 2~3틱 주입하면 대부분 finalize 발생
        for _ in range(3):
            live, finalized = self.segmenter.feed(is_silence=True)
            if finalized:
                await self._safe_send_json({"append": finalized})
                # 요약 구간 집계용으로 기록
                self.paragraph_buffer.append((time.time(), finalized))
                break

    async def flush_final_summary(self):
        """
        종료 직전: 라이브 버퍼까지 확정 -> 마지막 구간 요약(force=True) 생성 -> 전송.
        """
        # 1) 라이브 버퍼 강제 확정
        await self._force_finalize_live_buffer()

        # 2) 마지막 1분 요약 생성/전송 (force=True면 분량 부족이어도 실행)
        await self._flush_interval_summary(force=True)

        # 3) (선택) 프런트가 구분하기 쉬운 종료 이벤트
        await self._safe_send_json({"event": "final_summary_done"})

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
            await self._start_session(websocket, source="auto")
            logger.info(f"🟢 Session auto-begun by first feed(). sid={self.sid}")

        # === 원본 오디오 저장 ===
        self.raw_audio_buffer.extend(data)

        # === 1. VAD 체크 ===
        if not self.vad.has_speech(data):
            live, finalized = self.segmenter.feed(is_silence=True)
            if live:
                await self._safe_send_json({"realtime": live})

            if finalized:
                await self._safe_send_json({"append": finalized})
                # 확정 시점 기록
                self.paragraph_buffer.append((time.time(), finalized))
                logger.info(f"Finalized (silence): {finalized}")

                # ✅ Redis로 확정 히스토리 적재 (이 블록은 finalized가 있을 때만 실행돼야 함)
                if self.sid:
                    try:
                        # whisper segment의 절대시간(초)을 ms 단위로 변환
                        if (self._utt_min_start is not None) and (self._utt_max_end is not None):
                            ts_start_ms = int(self._utt_min_start * 1000)
                            ts_end_ms   = int(self._utt_max_end * 1000)
                        else:
                            # fallback (무음 등 segment 정보 없음)
                            now_ms = int(((time.time() - (self.session_start_ts or time.time())) * 1000))
                            ts_start_ms, ts_end_ms = now_ms, now_ms

                        await publish_segment(
                            sid=self.sid,
                            prefix=self.redis_prefix,
                            raw_text=finalized,
                            speaker_label=None,
                            ts_start_ms=ts_start_ms,
                            ts_end_ms=ts_end_ms,
                        )

                        # 문장 하나 확정했으니 누적 범위 리셋
                        self._utt_min_start = None
                        self._utt_max_end = None

                    except Exception as e:
                        logger.warning(f"publish_segment failed(silence): {e}")

            # ✅ 중요: 무음 분기에서는 여기서 종료
            return

        # === 2. STT 실행 (segments 반환) ===
        segments = await asyncio.to_thread(self.stt.feed, data, True)
        if segments is None:
            return

        # === 2-1. 현재 발화 구간(min start/max end) 누적 ===
        # segments 원소가 (token, start, end) 튜플이거나, 객체에 .start/.end 속성이 있다고 가정하여 안전하게 처리
        def _get_se_times(seg):
            s = getattr(seg, "start", None)
            e = getattr(seg, "end",   None)
            if s is None or e is None:
                if isinstance(seg, (list, tuple)) and len(seg) >= 3:
                    # 보편적 포맷: (word, start, end)
                    s, e = seg[1], seg[2]
            return s, e

        for _seg in segments:
            s, e = _get_se_times(_seg)
            if s is None or e is None:
                continue
            if self._utt_min_start is None or s < self._utt_min_start:
                self._utt_min_start = float(s)
            if self._utt_max_end is None or e > self._utt_max_end:
                self._utt_max_end = float(e)


        # === 3. 타임스탬프 Deduplication ===
        raw_text = self.deduper.filter(segments)
        if raw_text is None:
            return

        # === 4. 후처리 ===
        live, finalized = self.segmenter.feed(text=raw_text)

        if live:
            await self._safe_send_json({"realtime": live})
            logger.debug(f"Live Buffer: {live}")

        if finalized:
            await self._safe_send_json({"append": finalized})
            # 확정 시점 기록
            self.paragraph_buffer.append((time.time(), finalized))
            logger.info(f"Finalized: {finalized}")

            if self.sid:
                try:
                    # whisper segment의 절대시간(초)을 ms 단위로 변환
                    if (self._utt_min_start is not None) and (self._utt_max_end is not None):
                        ts_start_ms = int(self._utt_min_start * 1000)
                        ts_end_ms   = int(self._utt_max_end * 1000)
                    else:
                        # fallback (무음 등 segment 정보 없음)
                        now_ms = int(((time.time() - (self.session_start_ts or time.time())) * 1000))
                        ts_start_ms, ts_end_ms = now_ms, now_ms

                    await publish_segment(
                        sid=self.sid,
                        prefix=self.redis_prefix,
                        raw_text=finalized,
                        speaker_label=None,
                        ts_start_ms=ts_start_ms,
                        ts_end_ms=ts_end_ms,
                    )

                    # 확정 후 누적 범위 리셋
                    self._utt_min_start = None
                    self._utt_max_end = None
                except Exception as e:
                    logger.warning(f"publish_segment failed: {e}")

    # ---------------------------------------------------------------------
    # 상태 초기화/저장
    # ---------------------------------------------------------------------
    def reset(self):
        """오디오/세그먼트 버퍼만 비움(세션/태스크 유지)"""
        self.raw_audio_buffer.clear()
        self.segmenter.buffer = ""
        self.segmenter.silence_time = 0.0
        self.deduper.reset()
        # 발화 구간 추적 리셋
        self._utt_min_start = None
        self._utt_max_end = None
        logger.info("🔄 STT Pipeline 상태 초기화 완료 (buffers only)")

    def reset_all(self):
        """세션 전체 완전 초기화"""
        # 1) 내부 버퍼 초기화
        self.raw_audio_buffer.clear()
        self.segmenter.buffer = ""
        self.segmenter.silence_time = 0.0
        self.deduper.reset()
        self.paragraph_buffer.clear()
        self._utt_min_start = None
        self._utt_max_end = None

        # 2) 세션 상태 초기화
        self.session_active = False
        self.session_start_ts = None
        self.last_cut_ts = None
        self.ws = None

        # 3) 요약 루프 중단
        if self.summary_task and not self.summary_task.done():
            self.summary_task.cancel()
        self.summary_task = None

        logger.info("🧹 STT Pipeline 완전 초기화 완료")

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

        # ✅ Redis 메타에 오디오 파일 정보 기록 (비동기 환경 대응)
        try:
            from backend.app.util.redis_client import get_redis
            import asyncio

            async def _save_meta():
                r = await get_redis()
                await r.hset(
                    f"{self.redis_prefix}:{self.sid}:meta",
                    mapping={
                        "audio_path": filepath,
                        "duration_ms": int(duration * 1000),
                        "language": getattr(self, "lang", "ko")
                    }
                )

            # 이미 루프 실행 중인지 확인
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(_save_meta())  # ✅ 현재 루프에 태스크로 등록
            else:
                loop.run_until_complete(_save_meta())

            logger.info(f"🔖 Saved audio metadata to Redis for sid={self.sid}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to write audio metadata to Redis: {e}")
        
        return {"filepath": filepath, "duration": duration}