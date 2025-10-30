# backend/app/util/redis_publisher.py

import time
import json
import logging
from typing import Optional, Dict, Any
from .redis_client import get_redis

logger = logging.getLogger(__name__)

# 기본 포맷(접미사)
SEG_SUFFIX  = "{sid}:segments"
SUM_SUFFIX  = "{sid}:summaries"
META_SUFFIX = "{sid}:meta"


def _k(prefix: str, suffix_fmt: str, sid: str) -> str:
    """
    항상 날짜 prefix를 강제.
    예) prefix='stt:2025-10-20' -> 'stt:2025-10-20:<sid>:segments'
    """
    assert prefix and prefix.startswith("stt:"), "prefix is required (e.g., 'stt:YYYY-MM-DD')"
    return f"{prefix}:{suffix_fmt.format(sid=sid)}"


def now_ms() -> int:
    return int(time.time() * 1000)


# ── 메타: 녹음 시작/종료 ────────────────────────────────────────────────
async def init_session_meta(
    sid: str,
    prefix: str,
    sample_rate: Optional[int],
    vad_threshold: Optional[float],
    source: Optional[str],
    board_id: Optional[int] = None,
    user_id: Optional[int] = None,
    extra_fields: Optional[Dict[str, Any]] = None,
) -> None:
    """
    세션 시작 시 메타 저장.
    - 필수 시간축: started_at_ms
    - 선택: sample_rate, vad_threshold, source, board_id, user_id
    - extra_fields: 필요 시 임의의 키/값 추가 (원 타입 유지)

    NOTE: stt_model 같은 필드는 요구로 제거함.
    """
    r = await get_redis()
    fields: Dict[str, Any] = {
        "started_at_ms": now_ms(),
    }
    if sample_rate is not None:
        fields["sample_rate"] = sample_rate
    if vad_threshold is not None:
        fields["vad_threshold"] = vad_threshold
    if source is not None:
        fields["source"] = source
    if board_id is not None:
        fields["board_id"] = board_id
    if user_id is not None:
        fields["user_id"] = user_id
    if extra_fields:
        # 문자열 강제 변환은 하지 않고 원 타입 유지
        fields.update(extra_fields)

    # 메타 저장
    await r.hset(_k(prefix, META_SUFFIX, sid), mapping=fields)

    # 인덱스: 그날의 sid 집합/정렬셋 등록
    await r.sadd(f"{prefix}:sids", sid)
    await r.zadd(f"{prefix}:sid_starts", {sid: fields["started_at_ms"]})


async def end_session_meta(sid: str, *, prefix: str) -> None:
    r = await get_redis()
    t = now_ms()
    await r.hset(_k(prefix, META_SUFFIX, sid), "ended_at_ms", t)
    # 선택: 종료시간 정렬셋(필요 시)
    await r.zadd(f"{prefix}:sid_ends", {sid: t})


# ── 확정 히스토리(Stream) ─────────────────────────────────────────────
async def publish_segment(
    sid: str,
    raw_text: str,
    *,
    finalized_at_ms: Optional[int] = None,
    speaker_label: Optional[str] = None,
    confidence: Optional[float] = None,
    ts_start_ms: Optional[int] = None,
    ts_end_ms: Optional[int] = None,
    prefix: str,
) -> str:
    r = await get_redis()
    fields: Dict[str, Any] = {
        "raw_text": raw_text,
        "finalized_at_ms": finalized_at_ms or now_ms(),
    }
    # 🔸 None이면 필드 자체를 생략해서 XADD 필드가 비어들어가지 않도록
    if speaker_label:
        fields["speaker_label"] = speaker_label
    if confidence is not None:
        fields["confidence"] = confidence
    if ts_start_ms is not None:
        fields["ts_start_ms"] = ts_start_ms
    if ts_end_ms is not None:
        fields["ts_end_ms"] = ts_end_ms

    # 스트림 길이 제한(근사치) 유지 + 로깅
    key = _k(prefix, SEG_SUFFIX, sid)
    msg_id = await r.xadd(key, fields, maxlen=20000, approximate=True)
    try:
        logger.info(f"[XADD] {key} <- {json.dumps(fields, ensure_ascii=False)} id={msg_id}")
    except Exception:
        pass
    return msg_id

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
    prefix: str,
) -> str:
    r = await get_redis()
    fields: Dict[str, Any] = {
        "interval_start_ms": interval_start_ms,
        "interval_end_ms": interval_end_ms,
        "summary_text": summary_text,
    }
    if model is not None:
        fields["model"] = model
    if tokens_input is not None:
        fields["tokens_input"] = tokens_input
    if tokens_output is not None:
        fields["tokens_output"] = tokens_output
    if source_text is not None:
        fields["source_text"] = source_text

    key = _k(prefix, SUM_SUFFIX, sid)
    msg_id = await r.xadd(key, fields, maxlen=5000, approximate=True)
    try:
        logger.info(f"[XADD] {key} <- {json.dumps(fields, ensure_ascii=False)} id={msg_id}")
    except Exception:
        pass
    return msg_id
