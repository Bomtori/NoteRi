# backend/services/stt_pipeline.py

# === 표준 라이브러리 ===
import asyncio
import contextlib
import logging
import os
import time
import traceback
import wave
from datetime import datetime
from typing import Optional, Tuple, Any, List, Dict
from uuid import uuid4

# === 외부 라이브러리 ===
from starlette.websockets import WebSocketState

# === 내부 모듈 - ML 모델 ===
from backend.ml.stt_model import STTModel
from backend.ml.vad import VADFilter
from backend.ml.postprocess.silence_segmenter import SilenceSegmenter
from backend.ml.postprocess.text_cleaner import TextCleaner, normalize_transcript_lines
from backend.ml.postprocess.timestamp_deduplicator import TimestampDeduplicator
from backend.ml.preprocessing.realtime_cleaner import RealtimeCleaner

# === 내부 모듈 - 애플리케이션 ===
from backend.app.tasks.embedding_task import create_embeddings_for_session
from backend.app.tasks.final_summary import (
    build_final_summary_from_lines,
    fetch_lines_from_db,
    persist_final_summary,
)
from backend.app.tasks.redis_to_pg import ingest_one_session
from backend.app.util.llm_client import ollama_summarize_interval
from backend.app.util.redis_publisher import (
    end_session_meta,
    init_session_meta,
    publish_segment,
    publish_summary,
)

# === 설정 ===
from backend.config import VAD_SAMPLE_RATE, VAD_THRESHOLD

# === 서비스 ===
from backend.services.diarization import run_diarization_for_session

# === 환경변수 설정 ===
from dotenv import load_dotenv
load_dotenv()


# === 설정 클래스 ===
class PipelineConfig:
    """파이프라인 설정을 환경변수로 관리"""
    
    # 요약 관련
    SUMMARY_INTERVAL = float(os.getenv("SUMMARY_INTERVAL", "60.0"))
    TICK_INTERVAL = float(os.getenv("TICK_INTERVAL", "10.0"))
    MIN_CHARS_FOR_SUMMARY = int(os.getenv("MIN_CHARS_FOR_SUMMARY", "40"))
    
    # 메모리 관리
    MAX_AUDIO_BUFFER_SIZE = int(os.getenv("MAX_AUDIO_BUFFER_SIZE", str(100 * 1024 * 1024)))  # 100MB
    MAX_PARAGRAPH_COUNT = int(os.getenv("MAX_PARAGRAPH_COUNT", "1000"))
    AUDIO_SAVE_INTERVAL = int(os.getenv("AUDIO_SAVE_INTERVAL", "600"))  # 10분
    
    # 세션 타임아웃
    SESSION_TIMEOUT = int(os.getenv("SESSION_TIMEOUT", "60"))  # 1분
    
    # 재시도 설정
    MAX_RETRIES = int(os.getenv("REDIS_MAX_RETRIES", "3"))
    RETRY_DELAY = float(os.getenv("REDIS_RETRY_DELAY", "0.5"))


# === 헬퍼 함수 ===
def _short_sid() -> str:
    """
    작은 범위의 고유 ID 생성 (recording_sessions.id INTEGER 호환)
    
    Returns:
        str: 9자리 숫자 문자열
        
    Note:
        - 밀리초 타임스탬프의 하위 9자리 사용
        - INT4 범위(2,147,483,647) 안전하게 유지
        - 충돌 확률 극히 낮음
    """
    # 현재 밀리초 타임스탬프
    timestamp_ms = int(time.time() * 1000)
    
    # 하위 9자리만 사용 (최대 999,999,999)
    # 예: 1730280378123 → 280378123
    sid = timestamp_ms % 1000000000
    
    return str(sid)


def _date_prefix() -> str:
    """날짜 기반 네임스페이스 생성 (예: stt:2025-10-20)"""
    return datetime.now().strftime("stt:%Y-%m-%d")


# === 로깅 설정 ===
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("STTPipeline")


class STTPipeline:
    """
    실시간 STT 파이프라인
    
    주요 기능:
    - 실시간 음성 인식 (VAD + Whisper)
    - 1분 단위 구간 요약 생성
    - Redis 발행 및 PostgreSQL 저장
    - 세션 타임아웃 처리
    - 주기적 오디오 저장 (메모리 관리)
    
    사용법:
        pipeline = STTPipeline()
        await pipeline.begin_session(websocket)
        await pipeline.feed(audio_data)
        await pipeline.end_session()
    """
    
    def __init__(self):
        """
        파이프라인 초기화
        
        Note:
            - STT 모델과 VAD 필터는 인스턴스마다 생성됨
            - 동시 세션 지원을 위해 세션별로 독립된 인스턴스 필요
        """
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
        self.realtime_cleaner = RealtimeCleaner(use_typo_correction=True)

        # === 세션 상태 ===
        self.summary_task: Optional[asyncio.Task] = None
        self.timeout_task: Optional[asyncio.Task] = None
        self.audio_save_task: Optional[asyncio.Task] = None
        self.session_active = False
        self.ws = None
        self.session_start_ts: Optional[float] = None
        self.last_cut_ts: Optional[float] = None
        self.last_activity_ts: Optional[float] = None

        # === 버퍼 ===
        self.paragraph_buffer: List[Tuple[float, str]] = []
        self.raw_audio_buffer = bytearray()

        # === 세션 식별자 ===
        self.sid: Optional[str] = None
        self.redis_prefix: Optional[str] = None

        # === 발화 구간 추적 ===
        self._utt_min_start: Optional[float] = None
        self._utt_max_end: Optional[float] = None

        # === 저장 이력 ===
        self.last_saved_file: Optional[str] = None
        self.last_saved_duration: Optional[float] = None

        logger.info("✨ STTPipeline initialized")

    # -------------------------------------------------------------------------
    # 세션 수명주기 관리
    # -------------------------------------------------------------------------
    
    async def _start_session(self, websocket, *, source: str):
        """
        세션 시작 공통 로직
        
        Args:
            websocket: WebSocket 연결 객체
            source: 세션 시작 방식 ("manual" 또는 "auto")
            
        Note:
            - query parameter에서 sid, board_id 추출
            - Redis 메타 초기화
            - 요약 루프, 타임아웃 체크, 주기적 저장 시작
        """
        if self.session_active:
            logger.warning("Session already active, ignoring start request")
            return
        
        self.ws = websocket
        
        # WebSocket query parameters 추출
        query_sid = websocket.query_params.get("sid") if hasattr(websocket, "query_params") else None
        query_board_id = websocket.query_params.get("board_id") if hasattr(websocket, "query_params") else None
        
        # sid 생성 또는 추출 (숫자 문자열)
        if query_sid and query_sid.isdigit():
            self.sid = query_sid
        else:
            self.sid = _short_sid()
        
        # board_id 파싱
        board_id = None
        if query_board_id:
            try:
                board_id = int(query_board_id)
                logger.info(f"📋 WebSocket connected with board_id={board_id}", extra={
                    "event": "session_start",
                    "sid": self.sid,
                    "board_id": board_id
                })
            except ValueError:
                logger.warning(f"⚠️ Invalid board_id: {query_board_id}")
        
        # 날짜 prefix 고정
        self.redis_prefix = datetime.now().strftime("stt:%Y-%m-%d")
        
        self.session_active = True
        now = time.time()
        self.session_start_ts = now
        self.last_cut_ts = now
        self.last_activity_ts = now
        
        # 요약 루프 시작
        if self.summary_task is None or self.summary_task.done():
            self.summary_task = asyncio.create_task(self._summary_loop())
        
        # 타임아웃 체크 시작
        if self.timeout_task is None or self.timeout_task.done():
            self.timeout_task = asyncio.create_task(self._timeout_check_loop())
        
        # 주기적 오디오 저장 시작
        if self.audio_save_task is None or self.audio_save_task.done():
            self.audio_save_task = asyncio.create_task(self._periodic_audio_save())
        
        # Redis 메타 초기화
        try:
            await init_session_meta(
                sid=self.sid,
                prefix=self.redis_prefix,
                sample_rate=VAD_SAMPLE_RATE,
                vad_threshold=VAD_THRESHOLD,
                source=source,
                board_id=board_id,
            )
        except Exception as e:
            logger.warning(f"init_session_meta({source}) failed: {e}")
        
        # 프론트엔드에 세션 ID 알림
        await self._safe_send_json({"event": "session_started", "sid": self.sid})
        
        logger.info(f"🟢 Session started: sid={self.sid}, source={source}", extra={
            "event": "session_started",
            "sid": self.sid,
            "source": source,
            "board_id": board_id
        })

    async def begin_session(self, websocket):
        """
        수동 세션 시작 (WebSocket 연결 직후 명시적 호출)
        
        Args:
            websocket: WebSocket 연결 객체
        """
        await self._start_session(websocket, source="manual")

    async def end_session(self, run_diarization: bool = True):
        """
        세션 종료 - 안전한 정리 보장
        
        모든 단계를 독립적으로 실행하여 부분 실패 시에도 정리 완료
        
        Args:
            run_diarization: 화자 분리 실행 여부
            
        Note:
            - 각 정리 단계가 실패해도 다음 단계는 계속 실행
            - 최종 데이터는 비동기로 후처리
        """
        if not self.session_active:
            logger.warning("Session not active, ignoring end request")
            return
        
        errors = []
        
        # 1. 최종 데이터 수집 (가장 먼저 실행)
        all_lines_for_final: List[str] = []
        try:
            for ts, text in self.paragraph_buffer:
                if text and text.strip():
                    all_lines_for_final.append(text.strip())
            
            if self.segmenter and self.segmenter.buffer:
                buffer_text = self.segmenter.buffer.strip()
                if buffer_text:
                    all_lines_for_final.append(buffer_text)
                    
            logger.info(f"📝 Collected {len(all_lines_for_final)} lines for final summary")
        except Exception as e:
            errors.append(f"데이터 수집 실패: {e}")
            logger.error(f"Failed to collect final data: {e}")
        
        # 2. Redis 메타 종료
        if self.sid:
            try:
                await end_session_meta(self.sid, prefix=self.redis_prefix)
                logger.info(f"✅ Redis meta ended for sid={self.sid}")
            except Exception as e:
                errors.append(f"Redis 메타 종료 실패: {e}")
                logger.warning(f"end_session_meta failed: {e}")
        
        # 3. 백그라운드 태스크 중단
        tasks_to_cancel = [
            ("summary", self.summary_task),
            ("timeout", self.timeout_task),
            ("audio_save", self.audio_save_task),
        ]
        
        for task_name, task in tasks_to_cancel:
            if task and not task.done():
                try:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                    logger.info(f"✅ {task_name} task cancelled")
                except Exception as e:
                    errors.append(f"{task_name} 태스크 중단 실패: {e}")
                    logger.warning(f"Failed to cancel {task_name} task: {e}")
        
        self.summary_task = None
        self.timeout_task = None
        self.audio_save_task = None
        
        # 4. 세션 상태 정리 (반드시 실행)
        try:
            self.session_active = False
            self.ws = None
            logger.info("🔴 Session ended", extra={
                "event": "session_ended",
                "sid": self.sid,
                "duration": time.time() - self.session_start_ts if self.session_start_ts else 0
            })
            self.reset_all()
        except Exception as e:
            errors.append(f"세션 정리 실패: {e}")
            logger.error(f"Failed to reset session: {e}")
        
        # 5. 에러 로깅
        if errors:
            logger.warning(f"⚠️ Session end errors: {', '.join(errors)}")
        
        # 6. 후속 작업 (비동기로 실행하여 블로킹 방지)
        if self.sid:
            asyncio.create_task(
                self._finalize_session(all_lines_for_final, run_diarization)
            )

    async def _finalize_session(self, lines: List[str], run_diarization: bool):
        """
        세션 종료 후 후속 작업 (비동기 실행)
        
        Args:
            lines: 최종 요약에 사용할 텍스트 라인들
            run_diarization: 화자 분리 실행 여부
            
        Note:
            - Redis → PostgreSQL 적재
            - 최종 요약 생성 및 저장
            - 화자 분리 실행
            - 임베딩 생성
        """
        try:
            logger.info(f"🔄 Starting session finalization for sid={self.sid}")
            
            # Redis → PostgreSQL 적재
            try:
                await asyncio.to_thread(ingest_one_session, self.sid, self.redis_prefix)
                logger.info(f"✅ Redis→PG ingestion completed for sid={self.sid}")
            except Exception as e:
                logger.error(f"❌ Redis→PG ingestion failed: {e}")
            
            # 최종 요약 생성
            if lines:
                try:
                    # build_final_summary_from_lines는 async 함수
                    final_summary = await build_final_summary_from_lines(lines)
                    raw_text = "\n".join([ln for ln in lines if ln and ln.strip()])
                    
                    if final_summary:
                        # persist_final_summary는 동기 함수, recording_session_id 필요
                        await asyncio.to_thread(
                            persist_final_summary,
                            recording_session_id=int(self.sid),  # DB의 recording_sessions.id (integer)
                            summary_json=final_summary,
                            raw_text=raw_text
                        )
                        logger.info(f"✅ Final summary persisted for sid={self.sid}")
                except Exception as e:
                    logger.error(f"❌ Failed to generate final summary: {e}")
            
            # Diarization 실행
            if run_diarization:
                try:
                    await asyncio.to_thread(
                        run_diarization_for_session,
                        self.sid
                    )
                    logger.info(f"✅ Diarization completed for sid={self.sid}")
                except Exception as e:
                    logger.error(f"❌ Diarization failed: {e}")
            
            # Embedding 생성
            try:
                await create_embeddings_for_session(self.sid)
                logger.info(f"✅ Embeddings created for sid={self.sid}")
            except Exception as e:
                logger.error(f"❌ Failed to create embeddings: {e}")
            
            logger.info(f"🎉 Session finalization completed for sid={self.sid}")
                
        except Exception as e:
            logger.error(f"❌ Session finalization failed: {e}\n{traceback.format_exc()}")

    # -------------------------------------------------------------------------
    # 백그라운드 루프
    # -------------------------------------------------------------------------
    
    async def _summary_loop(self):
        """
        효율적인 요약 생성 루프
        
        Note:
            - SUMMARY_INTERVAL(기본 60초)마다 요약 생성
            - 남은 시간을 계산하여 효율적으로 대기
            - TICK_INTERVAL(기본 10초) 단위로 체크하여 즉시 반응
        """
        logger.info("📊 Summary loop started")
        
        while self.session_active:
            try:
                now = time.time()
                elapsed = now - (self.last_cut_ts or now)
                wait_time = max(0, PipelineConfig.SUMMARY_INTERVAL - elapsed)
                
                if wait_time > 0:
                    # 남은 시간만큼 대기 (최대 tick_interval)
                    await asyncio.sleep(min(wait_time, PipelineConfig.TICK_INTERVAL))
                    continue
                
                # 요약 실행
                await self._make_summary(now)
                
            except asyncio.CancelledError:
                logger.info("📊 Summary loop cancelled")
                break
            except Exception as e:
                logger.error(f"❌ Summary loop error: {e}\n{traceback.format_exc()}")
                await asyncio.sleep(PipelineConfig.TICK_INTERVAL)

    async def _timeout_check_loop(self):
        """
        세션 타임아웃 체크 루프
        
        Note:
            - SESSION_TIMEOUT(기본 60초) 동안 활동 없으면 자동 종료
            - 1분마다 체크
        """
        logger.info(f"⏰ Timeout check loop started (timeout={PipelineConfig.SESSION_TIMEOUT}s)")
        
        while self.session_active:
            try:
                await asyncio.sleep(60)  # 1분마다 체크
                
                if self.last_activity_ts:
                    idle_time = time.time() - self.last_activity_ts
                    
                    if idle_time > PipelineConfig.SESSION_TIMEOUT:
                        logger.warning(f"⏰ Session timeout: {idle_time:.1f}s idle (sid={self.sid})", extra={
                            "event": "session_timeout",
                            "sid": self.sid,
                            "idle_time": idle_time
                        })
                        
                        await self._safe_send_json({
                            "event": "timeout",
                            "message": f"{PipelineConfig.SESSION_TIMEOUT}초 동안 활동이 없어 세션을 종료합니다."
                        })
                        
                        await self.end_session()
                        break
                        
            except asyncio.CancelledError:
                logger.info("⏰ Timeout check loop cancelled")
                break
            except Exception as e:
                logger.error(f"❌ Timeout check error: {e}")

    async def _periodic_audio_save(self):
        """
        주기적 오디오 저장 (메모리 관리)
        
        Note:
            - AUDIO_SAVE_INTERVAL(기본 600초=10분)마다 저장
            - 저장 후 버퍼 비워서 메모리 절약
        """
        logger.info(f"💾 Periodic audio save loop started (interval={PipelineConfig.AUDIO_SAVE_INTERVAL}s)")
        
        while self.session_active:
            try:
                await asyncio.sleep(PipelineConfig.AUDIO_SAVE_INTERVAL)
                
                if len(self.raw_audio_buffer) > 0:
                    logger.info(f"💾 Periodic audio save triggered (buffer size: {len(self.raw_audio_buffer)} bytes)")
                    
                    result = await self.save_raw_audio_async()
                    if result:
                        logger.info(f"✅ Audio saved: {result['filepath']} ({result['duration']:.2f}s)")
                        # 저장 후 버퍼 비우기
                        self.raw_audio_buffer.clear()
                        logger.info("🧹 Audio buffer cleared after save")
                        
            except asyncio.CancelledError:
                logger.info("💾 Periodic audio save loop cancelled")
                break
            except Exception as e:
                logger.error(f"❌ Periodic audio save error: {e}")

    async def _make_summary(self, now: float):
        """
        구간 요약 생성
        
        Args:
            now: 현재 시각 (초)
            
        Note:
            - [last_cut_ts, now) 구간의 확정 문장 수집
            - 최소 문자 수 미달 시 다음 구간으로 누적
            - Redis 발행 및 WebSocket 전송
        """
        if not self.last_cut_ts:
            return
        
        # 확정 문장 수집
        confirmed = []
        for ts, text in self.paragraph_buffer:
            if self.last_cut_ts <= ts < now:
                confirmed.append(text)
        
        # 실시간 버퍼 추가
        live_buf = self.segmenter.buffer.strip() if self.segmenter else ""
        all_text = " ".join(confirmed + ([live_buf] if live_buf else []))
        
        if len(all_text) < PipelineConfig.MIN_CHARS_FOR_SUMMARY:
            logger.debug(f"📊 Text too short for summary: {len(all_text)} chars (min: {PipelineConfig.MIN_CHARS_FOR_SUMMARY})")
            return
        
        try:
            logger.info(f"📊 Generating summary for {len(confirmed)} sentences ({len(all_text)} chars)")
            
            # 요약 생성 (이미 async 함수)
            summary_text = await ollama_summarize_interval(all_text)
            
            if summary_text:
                # Redis 발행
                if self.sid:
                    await self._publish_with_retry(
                        publish_summary,
                        sid=self.sid,
                        prefix=self.redis_prefix,
                        summary_text=summary_text,
                        interval_start_ms=int(self.last_cut_ts * 1000),
                        interval_end_ms=int(now * 1000)
                    )
                
                # WebSocket 전송
                await self._safe_send_json({
                    "summary": summary_text,
                    "start_ts": self.last_cut_ts,
                    "end_ts": now
                })
                
                logger.info(f"✅ Summary generated: {summary_text[:50]}...", extra={
                    "event": "summary_generated",
                    "sid": self.sid,
                    "length": len(summary_text),
                    "time_range": f"{self.last_cut_ts}-{now}"
                })
                
        except Exception as e:
            logger.error(f"❌ Failed to generate summary: {e}\n{traceback.format_exc()}")
        finally:
            self.last_cut_ts = now

    # -------------------------------------------------------------------------
    # 오디오 처리 파이프라인
    # -------------------------------------------------------------------------
    
    async def feed(self, data: bytes):
        """
        오디오 데이터 처리 메인 로직
        
        처리 단계:
        1. VAD 필터링으로 음성 구간 감지
        2. STT 모델로 음성 → 텍스트 변환
        3. 타임스탬프 중복 제거
        4. 무음 기반 문장 분할
        5. Redis 발행 및 WebSocket 전송
        
        Args:
            data: PCM 형식의 오디오 바이트 데이터
                  - 샘플레이트: 16000Hz
                  - 비트: 16bit
                  - 채널: 1 (모노)
                  
        Returns:
            None
            
        Raises:
            Exception: STT 처리 실패 시 (로깅 후 계속 진행)
            
        Note:
            - 세션이 활성화되지 않은 경우 자동으로 시작
            - 버퍼 크기가 MAX_AUDIO_BUFFER_SIZE를 초과하면 자동 정리
            - 활동 시각 갱신 (타임아웃 방지)
        """
        # 세션 자동 시작
        if not self.session_active and self.ws:
            await self._start_session(self.ws, source="auto")
        
        # 활동 시각 갱신
        self.last_activity_ts = time.time()
        
        # 버퍼 크기 체크
        if len(self.raw_audio_buffer) + len(data) > PipelineConfig.MAX_AUDIO_BUFFER_SIZE:
            logger.warning(f"⚠️ Audio buffer size exceeded ({len(self.raw_audio_buffer)} bytes), trimming old data")
            self.raw_audio_buffer = self.raw_audio_buffer[len(self.raw_audio_buffer)//2:]
        
        self.raw_audio_buffer.extend(data)
        
        # 1. VAD 필터링
        is_speech = self.vad.has_speech(data)  # 기존 메서드명 사용
        
        if not is_speech:
            # 무음 처리 - 기존 메서드 사용
            live, finalized = self.segmenter.feed(is_silence=True)
            
            if live:
                await self._safe_send_json({"realtime": live})
            
            if finalized:
                await self._safe_send_json({"append": finalized})
                self.paragraph_buffer.append((time.time(), finalized))
                
                # 문장 버퍼 크기 체크
                if len(self.paragraph_buffer) > PipelineConfig.MAX_PARAGRAPH_COUNT:
                    logger.warning(f"⚠️ Paragraph buffer exceeded ({len(self.paragraph_buffer)} entries), trimming")
                    self.paragraph_buffer = self.paragraph_buffer[-500:]
                
                logger.info(f"✅ Finalized (silence): {finalized[:50]}...")
                
                # Redis 발행
                await self._publish_finalized_segment(finalized, context="silence")
            
            return
        
        # 2. STT 실행
        try:
            segments = await asyncio.to_thread(self.stt.feed, data, True)
        except Exception as e:
            logger.error(f"❌ STT processing failed: {e}\n{traceback.format_exc()}")
            await self._safe_send_json({"error": "STT 처리 중 오류가 발생했습니다."})
            return
        
        if segments is None:
            return
        
        # 3. 발화 구간 시간 누적
        for seg in segments:
            s, e = self._extract_segment_times(seg)
            if s is not None and e is not None:
                if self._utt_min_start is None or s < self._utt_min_start:
                    self._utt_min_start = float(s)
                if self._utt_max_end is None or e > self._utt_max_end:
                    self._utt_max_end = float(e)
        
        # 4. 타임스탬프 중복 제거
        raw_text = self.deduper.filter(segments)
        if raw_text is None:
            return
        
        # 5. 문장 분할
        live, finalized = self.segmenter.feed(text=raw_text)
        
        if live:
            await self._safe_send_json({"realtime": live})
            logger.debug(f"🔄 Live Buffer: {live[:50]}...")
        
        if finalized:
            await self._safe_send_json({"append": finalized})
            self.paragraph_buffer.append((time.time(), finalized))
            
            # 문장 버퍼 크기 체크
            if len(self.paragraph_buffer) > PipelineConfig.MAX_PARAGRAPH_COUNT:
                logger.warning(f"⚠️ Paragraph buffer exceeded ({len(self.paragraph_buffer)} entries), trimming")
                self.paragraph_buffer = self.paragraph_buffer[-500:]
            
            logger.info(f"✅ Finalized: {finalized[:50]}...")
            
            # Redis 발행
            await self._publish_finalized_segment(finalized, context="stt")

    async def _publish_finalized_segment(self, finalized_text: str, context: str = ""):
        """
        확정된 세그먼트를 Redis에 발행 (공통 로직)
        
        Args:
            finalized_text: 확정된 텍스트
            context: 발행 컨텍스트 ("silence" 또는 "stt")
            
        Note:
            - 재시도 로직 포함
            - 타임스탬프 자동 계산
        """
        if not self.sid:
            return
        
        try:
            ts_start_ms, ts_end_ms = self._calculate_timestamps_ms()
            
            await self._publish_with_retry(
                publish_segment,
                sid=self.sid,
                prefix=self.redis_prefix,
                raw_text=finalized_text,
                speaker_label=None,
                ts_start_ms=ts_start_ms,
                ts_end_ms=ts_end_ms,
            )
            
            # 누적 범위 리셋
            self._utt_min_start = None
            self._utt_max_end = None
            
        except Exception as e:
            logger.warning(f"⚠️ publish_segment failed({context}): {e}")

    async def _publish_with_retry(self, publish_func, *args, **kwargs) -> bool:
        """
        재시도 로직을 포함한 Redis 발행
        
        Args:
            publish_func: 발행 함수 (publish_segment, publish_summary 등)
            *args, **kwargs: 발행 함수의 인자들
            
        Returns:
            bool: 성공 여부
            
        Note:
            - MAX_RETRIES(기본 3)번 재시도
            - 지수 백오프 적용 (0.5초, 1초, 1.5초)
        """
        for attempt in range(PipelineConfig.MAX_RETRIES):
            try:
                await publish_func(*args, **kwargs)
                
                if attempt > 0:
                    logger.info(f"✅ Redis publish succeeded after {attempt + 1} attempts")
                
                return True
                
            except Exception as e:
                if attempt == PipelineConfig.MAX_RETRIES - 1:
                    logger.error(f"❌ Redis publish failed after {PipelineConfig.MAX_RETRIES} attempts: {e}")
                    return False
                
                wait_time = PipelineConfig.RETRY_DELAY * (attempt + 1)
                logger.warning(f"⚠️ Redis publish failed (attempt {attempt + 1}/{PipelineConfig.MAX_RETRIES}), retrying in {wait_time}s: {e}")
                await asyncio.sleep(wait_time)
        
        return False

    def _calculate_timestamps_ms(self) -> Tuple[int, int]:
        """
        현재 발화 구간의 타임스탬프를 ms 단위로 계산
        
        Returns:
            Tuple[int, int]: (시작 시각 ms, 종료 시각 ms)
            
        Note:
            - Whisper segment의 시간 정보 우선 사용
            - 없으면 현재 시각 기준으로 fallback
        """
        if (self._utt_min_start is not None) and (self._utt_max_end is not None):
            ts_start_ms = int(self._utt_min_start * 1000)
            ts_end_ms = int(self._utt_max_end * 1000)
        else:
            # fallback: 현재 시각 기준
            elapsed_ms = int((time.time() - (self.session_start_ts or time.time())) * 1000)
            ts_start_ms, ts_end_ms = elapsed_ms, elapsed_ms
        
        return ts_start_ms, ts_end_ms

    def _extract_segment_times(self, seg: Any) -> Tuple[Optional[float], Optional[float]]:
        """
        세그먼트에서 시작/종료 시간 추출 (다양한 포맷 지원)
        
        Args:
            seg: 세그먼트 객체 또는 튜플
                - 객체 속성: seg.start, seg.end
                - 튜플/리스트: (word, start, end)
                
        Returns:
            Tuple[Optional[float], Optional[float]]: (시작 시각, 종료 시각)
        """
        s = getattr(seg, "start", None)
        e = getattr(seg, "end", None)
        
        if s is None or e is None:
            if isinstance(seg, (list, tuple)) and len(seg) >= 3:
                s, e = seg[1], seg[2]
        
        return (float(s) if s is not None else None,
                float(e) if e is not None else None)

    # -------------------------------------------------------------------------
    # WebSocket 통신
    # -------------------------------------------------------------------------
    
    async def _safe_send_json(self, payload: Dict):
        """
        WebSocket이 활성 상태일 때만 JSON 전송
        
        Args:
            payload: 전송할 JSON 데이터
            
        Note:
            - 연결 상태 확인 후 전송
            - 연결 끊김 감지 시 세션 비활성화
        """
        if not self.ws:
            return
        
        try:
            # WebSocket 상태 확인
            if hasattr(self.ws, 'client_state'):
                if self.ws.client_state != WebSocketState.CONNECTED:
                    logger.debug("WebSocket not connected, skipping send")
                    return
            
            await self.ws.send_json(payload)
            
        except Exception as e:
            logger.warning(f"⚠️ WebSocket send failed: {e}")
            # 연결 끊김 감지 시 세션 비활성화
            if "connection" in str(e).lower() or "closed" in str(e).lower():
                self.session_active = False

    # -------------------------------------------------------------------------
    # 상태 초기화 및 저장
    # -------------------------------------------------------------------------
    
    def reset(self):
        """
        오디오/세그먼트 버퍼만 비움 (세션 유지)
        
        Note:
            - 세션 상태는 유지
            - 버퍼만 초기화
        """
        self.raw_audio_buffer.clear()
        self.segmenter.buffer = ""
        self.segmenter.silence_time = 0.0
        self.deduper.reset()
        self._utt_min_start = None
        self._utt_max_end = None
        logger.info("🔄 STT Pipeline buffers reset")

    def reset_all(self):
        """
        세션 전체 완전 초기화
        
        Note:
            - 모든 버퍼 비움
            - 세션 상태 초기화
            - 백그라운드 태스크는 별도로 중단 필요
        """
        # 1. 버퍼 초기화
        self.raw_audio_buffer.clear()
        self.segmenter.buffer = ""
        self.segmenter.silence_time = 0.0
        self.deduper.reset()
        self.paragraph_buffer.clear()
        self._utt_min_start = None
        self._utt_max_end = None
        
        # 2. 세션 상태 초기화
        self.session_active = False
        self.session_start_ts = None
        self.last_cut_ts = None
        self.last_activity_ts = None
        self.ws = None
        
        logger.info("🧹 STT Pipeline fully reset")

    async def save_raw_audio_async(self, folder: Optional[str] = None, filename: Optional[str] = None) -> Optional[Dict]:
        """
        원본 오디오를 WAV 파일로 비동기 저장
        
        Args:
            folder: 저장 폴더 경로 (None이면 기본 경로)
            filename: 파일명 (None이면 자동 생성)
            
        Returns:
            Dict: {"filepath": str, "duration": float} 또는 None
            
        Note:
            - 파일 I/O는 별도 스레드에서 실행
            - Redis 메타데이터 자동 저장
        """
        if not self.raw_audio_buffer:
            logger.warning("⚠️ No audio data to save")
            return None
        
        # 파일 저장 (블로킹 작업은 스레드에서)
        result = await asyncio.to_thread(
            self._save_audio_file,
            folder,
            filename
        )
        
        if not result:
            return None
        
        # Redis 메타데이터 저장
        if self.sid:
            try:
                from backend.app.util.redis_client import get_redis
                r = await get_redis()
                await r.hset(
                    f"{self.redis_prefix}:{self.sid}:meta",
                    mapping={
                        "audio_path": result["filepath"],
                        "duration_ms": int(result["duration"] * 1000),
                        "language": getattr(self, "lang", "ko")
                    }
                )
                logger.info(f"🔖 Saved audio metadata to Redis for sid={self.sid}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to write audio metadata to Redis: {e}")
        
        return result

    def _save_audio_file(self, folder: Optional[str], filename: Optional[str]) -> Optional[Dict]:
        """
        실제 파일 저장 로직 (동기 실행)
        
        Args:
            folder: 저장 폴더 경로
            filename: 파일명
            
        Returns:
            Dict: {"filepath": str, "duration": float} 또는 None
        """
        try:
            # 기본 경로 설정
            if folder is None:
                base_dir = os.path.dirname(os.path.abspath(__file__))
                folder = os.path.normpath(os.path.join(base_dir, "..", "recordings"))
            os.makedirs(folder, exist_ok=True)
            
            if filename is None:
                filename = datetime.now().strftime("%Y%m%d_%H%M%S_%f_meeting.wav")
            
            filepath = os.path.join(folder, filename)
            
            # WAV 파일 작성
            with wave.open(filepath, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(VAD_SAMPLE_RATE)
                wf.writeframes(memoryview(self.raw_audio_buffer))
            
            # Duration 계산
            with contextlib.closing(wave.open(filepath, 'r')) as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                duration = frames / float(rate)
            
            logger.info(f"💾 Audio saved at: {filepath} (duration={duration:.2f}s)", extra={
                "event": "audio_saved",
                "filepath": filepath,
                "duration": duration,
                "size": len(self.raw_audio_buffer)
            })
            
            self.last_saved_file = filepath
            self.last_saved_duration = duration
            
            return {"filepath": filepath, "duration": duration}
            
        except Exception as e:
            logger.error(f"❌ Failed to save audio file: {e}\n{traceback.format_exc()}")
            return None

    # 동기 버전 (하위 호환성)
    def save_raw_audio(self, folder: Optional[str] = None, filename: Optional[str] = None) -> Optional[Dict]:
        """
        동기 버전의 오디오 저장 (하위 호환성)
        
        Note:
            - 가능하면 save_raw_audio_async() 사용 권장
            - 이 메서드는 단순히 _save_audio_file() 호출
        """
        return self._save_audio_file(folder, filename)

    async def flush_final_summary(self):
        """
        최종 요약 즉시 생성 및 전송
        
        Note:
            - 세션 종료 시 호출
            - 남은 버퍼 내용으로 마지막 요약 생성
        """
        if not self.session_active:
            return
        
        try:
            now = time.time()
            await self._make_summary(now)
            logger.info("✅ Final summary flushed")
        except Exception as e:
            logger.error(f"❌ Failed to flush final summary: {e}")