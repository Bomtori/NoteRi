# backend/services/stt_pipeline.py

import asyncio
import logging
import wave
import os
import contextlib
from datetime import datetime

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

        # 상태 관리
        self.paragraph_buffer = []
        self.summary_task = None

        # 원본 오디오 버퍼
        self.raw_audio_buffer = bytearray()

        # ✅ 마지막 저장된 파일 경로 & duration
        self.last_saved_file = None
        self.last_saved_duration = None

    async def start_summary_task(self, websocket):
        if self.summary_task is None:
            self.summary_task = asyncio.create_task(self.periodic_summary(websocket))

    async def periodic_summary(self, websocket):
        """1분마다 버퍼 내용을 요약"""
        try:
            while True:
                await asyncio.sleep(60)
                if self.paragraph_buffer and not self.segmenter.buffer.strip():
                    paragraph_text = " ".join(self.paragraph_buffer)
                    summary = self.summarizer.summarize(paragraph_text)

                    await websocket.send_json({
                        "paragraph": paragraph_text,
                        "summary": summary
                    })
                    logger.info(f"Paragraph saved: {paragraph_text}")
                    logger.info(f"Summary:\n{summary}")

                    self.paragraph_buffer = []
        except asyncio.CancelledError:
            logger.warning("Summary task stopped.")

    async def feed(self, data, websocket):
        """오디오 data → VAD → STT → Dedup → Segment → WebSocket"""
        # === 원본 오디오 저장 ===
        self.raw_audio_buffer.extend(data)

        await self.start_summary_task(websocket)

        # === 1. VAD 체크 ===
        if not self.vad.has_speech(data):
            live, finalized = self.segmenter.feed(is_silence=True)
            if finalized:
                await websocket.send_json({"append": finalized})
                self.paragraph_buffer.append(finalized)
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
            self.paragraph_buffer.append(finalized)
            logger.info(f"Finalized: {finalized}")

        logger.debug(f"Deduped Text: {raw_text}")

    def reset(self):
        """모든 버퍼/상태 초기화"""
        self.raw_audio_buffer.clear()
        self.segmenter.buffer = ""
        self.segmenter.silence_time = 0.0
        self.deduper.reset()
        self.paragraph_buffer = []
        print("🔄 STT Pipeline 상태 초기화 완료")

    def save_raw_audio(self, folder=None, filename=None):
        """원본 오디오를 WAV 파일로 저장"""
        if not self.raw_audio_buffer:
            logger.warning("No audio data to save.")
            return None

        # ✅ backend/services 기준으로 recordings 폴더 경로 설정
        if folder is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))  # backend/services/
            folder = os.path.join(base_dir, "..", "recordings")    # backend/recordings
            folder = os.path.normpath(folder)  # 경로 정규화 (../ 처리)
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

