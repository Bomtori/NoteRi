# backend/app/util/redis_publisher.py
import time
from typing import Optional, Dict, Any
from .redis_client import get_redis

SEG_KEY_FMT  = "stt:{sid}:segments"     # 확정 히스토리(Stream)
SUM_KEY_FMT  = "stt:{sid}:summaries"    # 1분 요약(Stream)
META_KEY_FMT = "stt:{sid}:meta"         # 메타(Hash)

def _k(fmt: str, sid: str) -> str:
    return fmt.format(sid=sid)

def now_ms() -> int:
    return int(time.time() * 1000)

# ── 메타: 녹음 시작/종료 ────────────────────────────────────────────────
async def init_session_meta(sid: str, *, sample_rate: int, stt_model: str, vad_threshold: float):
    r = await get_redis()
    await r.hset(_k(META_KEY_FMT, sid), mapping={
        "started_at_ms": now_ms(),
        "sample_rate": sample_rate,
        "stt_model": stt_model,
        "vad_threshold": vad_threshold,
    })

async def end_session_meta(sid: str):
    r = await get_redis()
    await r.hset(_k(META_KEY_FMT, sid), "ended_at_ms", now_ms())

# ── 확정 히스토리(Stream) ─────────────────────────────────────────────
async def publish_segment(
    sid: str,
    raw_text: str,
    *,
    finalized_at_ms: Optional[int] = None,
    speaker_label: str = "A",
    confidence: Optional[float] = None,
    ts_start_ms: Optional[int] = None,
    ts_end_ms: Optional[int] = None,
    model: Optional[str] = None,
) -> str:
    r = await get_redis()
    fields: Dict[str, Any] = {
        "raw_text": raw_text,
        "speaker_label": speaker_label,
        "finalized_at_ms": finalized_at_ms or now_ms(),
    }
    if confidence  is not None: fields["confidence"]  = confidence
    if ts_start_ms is not None: fields["ts_start_ms"] = ts_start_ms
    if ts_end_ms   is not None: fields["ts_end_ms"]   = ts_end_ms
    if model       is not None: fields["model"]       = model

    return await r.xadd(_k(SEG_KEY_FMT, sid), fields, maxlen=20000, approximate=True)

# ── 1분 요약(Stream) ──────────────────────────────────────────────────
async def publish_summary(
    sid: str,
    interval_start_ms: int,
    interval_end_ms: int,
    summary_text: str,
    *,
    model: Optional[str] = None,
    tokens_input: Optional[int] = None,
    tokens_output: Optional[int] = None,
    source_text: Optional[str] = None,
) -> str:
    r = await get_redis()
    fields: Dict[str, Any] = {
        "interval_start_ms": interval_start_ms,
        "interval_end_ms": interval_end_ms,
        "summary_text": summary_text,
    }
    if model         is not None: fields["model"]         = model
    if tokens_input  is not None: fields["tokens_input"]  = tokens_input
    if tokens_output is not None: fields["tokens_output"] = tokens_output
    if source_text   is not None: fields["source_text"]   = source_text

    return await r.xadd(_k(SUM_KEY_FMT, sid), fields, maxlen=5000, approximate=True)
