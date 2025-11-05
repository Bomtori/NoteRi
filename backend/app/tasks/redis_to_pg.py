# backend/app/tasks/redis_to_pg.py
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from backend.app.db import SessionLocal
from backend.app import model as models
from backend.app.util.redis_client import get_redis
# ⬇️ stt_pipeline.py 최상단에 추가해 둔 함수 재사용 (키 네이밍 완전 일치)
from backend.services.stt_pipeline import build_keys

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ──────────────────────────────────────────────────────────────────────────────
# 유틸
# ──────────────────────────────────────────────────────────────────────────────

def _ms_to_dt(ms: Optional[int]) -> Optional[datetime]:
    if ms is None:
        return None
    try:
        # DB가 timezone-aware라면 UTC로 저장, naive면 .replace(tzinfo=None) 써도 무방
        return datetime.fromtimestamp(int(ms) / 1000.0, tz=timezone.utc)
    except Exception:
        return None
    
def _ms_rel_or_abs_to_dt(ms: Optional[int], base: Optional[datetime]) -> Optional[datetime]:
    """
    ms가 '상대 ms'(세션 시작 기준)인지 '절대 epoch ms'인지 구분해 datetime으로 변환.
    - 보수적 기준: 1e12(≈ 2001-09-09) 이상이면 '절대 ms'로 간주
    - 그 외에는 '상대 ms'로 보고 base + delta 적용
    """
    if ms is None:
        return None
    try:
        ms_int = int(ms)
    except Exception:
        return None
    # 절대 ms로 보이는 경우
    if ms_int >= 10**12:
        return _ms_to_dt(ms_int)
    # 상대 ms인 경우 (base가 있어야 함)
    if base is None:
        return None
    return base + timedelta(milliseconds=ms_int)

def _b2s(v: Any) -> Any:
    if isinstance(v, bytes):
        return v.decode("utf-8", "ignore")
    return v

def _bmap2s(m: Dict[Any, Any]) -> Dict[str, Any]:
    return { _b2s(k): _b2s(v) for k, v in m.items() }

def _as_int(v: Any) -> Optional[int]:
    try:
        if v is None:
            return None
        return int(v)
    except Exception:
        return None

def _as_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)
    except Exception:
        return None

# ──────────────────────────────────────────────────────────────────────────────
# 메인 진입점
# ──────────────────────────────────────────────────────────────────────────────

async def ingest_session_to_db(*, sid: str, prefix: str) -> int:
    """
    Redis에 쌓인 한 세션의 메타/스트림을 읽어 PostgreSQL에 영속화.

    Args:
        sid: 세션 식별자(= recording_sessions.id 로 사용)
        prefix: 날짜 prefix (예: 'stt:2025-11-04')

    Returns:
        session_id (int)

    Raises:
        Exception: 읽기/파싱/DB 쓰기 단계에서의 모든 예외는 로그 후 re-raise
    """
    r = await get_redis()
    keys = build_keys(prefix, sid)

    # 1) meta 읽기 (hash/string 모두 지원)
    logger.info("📦 Ingest start: sid=%s prefix=%s", sid, prefix)
    meta_type = await r.type(keys["meta"])
    if isinstance(meta_type, bytes):
        meta_type = meta_type.decode()

    if meta_type == "hash":
        meta_map = await r.hgetall(keys["meta"])
        meta = _bmap2s(meta_map)
    elif meta_type == "string":
        meta_json = await r.get(keys["meta"])
        meta = json.loads(_b2s(meta_json)) if meta_json else {}
    elif meta_type == "none":
        raise RuntimeError(f"meta key not found: {keys['meta']}")
    else:
        raise RuntimeError(f"unexpected meta key type={meta_type} for {keys['meta']}")

    # 필터링/파싱
    started_at_ms = _as_int(meta.get("started_at_ms"))
    ended_at_ms   = _as_int(meta.get("ended_at_ms"))  # end_session_meta가 넣었을 것으로 가정 (없어도 OK)
    board_id      = _as_int(meta.get("board_id"))
    user_id       = _as_int(meta.get("user_id"))
    audio_path    = meta.get("audio_path")
    duration_ms   = _as_int(meta.get("duration_ms"))
    language      = meta.get("language") or meta.get("lang")

    dt_started = _ms_to_dt(started_at_ms)
    dt_ended   = _ms_to_dt(ended_at_ms)

    # 2) 스트림 읽기
    seg_entries: List[Tuple[str, Dict[str, Any]]] = await r.xrange(keys["segments"], "-", "+")
    sum_entries: List[Tuple[str, Dict[str, Any]]] = await r.xrange(keys["summaries"], "-", "+")

    session_id = int(sid)
    with SessionLocal() as db:
        try:
            # ✅ user_id 보정: meta에 없으면 board.owner_id로 폴백
            resolved_user_id = user_id
            if resolved_user_id is None and board_id is not None and hasattr(models, "Board"):
                owner_row = db.query(models.Board.owner_id).filter(models.Board.id == board_id).first()
                if owner_row and owner_row[0] is not None:
                    resolved_user_id = int(owner_row[0])

            if resolved_user_id is None:
                # 스키마가 NOT NULL이면 여기서 명시적으로 막아 오류 원인을 분명히 함
                raise RuntimeError(
                    f"user_id is required but missing (sid={sid}, board_id={board_id}); "
                    "meta had no user_id and board lookup failed."
                )

            # 3-1) RecordingSession upsert(=merge)
            sess_payload = {
                "id": session_id,
                "board_id": board_id,
                "user_id": resolved_user_id,   # ⬅️ 여기!
                "started_at": dt_started,
                "ended_at": dt_ended,
            }

            # ✅ status: 종료 후 적재이므로 'saved'
            status_value = "saved"
            try:
                from backend.app.model import RecordingType
                if hasattr(RecordingType, "saved"):
                    status_value = RecordingType.saved
            except Exception:
                pass
            if hasattr(models.RecordingSession, "status"):
                sess_payload["status"] = status_value

            # 선택 필드들 (있을 때만)
            if hasattr(models.RecordingSession, "is_diarized"):
                sess_payload["is_diarized"] = False
            if hasattr(models.RecordingSession, "audio_path") and audio_path:
                sess_payload["audio_path"] = audio_path
            if hasattr(models.RecordingSession, "duration_ms") and duration_ms is not None:
                sess_payload["duration_ms"] = duration_ms
            if hasattr(models.RecordingSession, "language") and language:
                sess_payload["language"] = language

            sess_obj = models.RecordingSession(**sess_payload)
            db.merge(sess_obj)
            db.flush()

            # 3-2) segments → RecordingResult (존재할 때만)
            if hasattr(models, "RecordingResult"):
                batch_results = []
                for _id, data in seg_entries:
                    fm = _bmap2s(data)
                    raw_text = fm.get("raw_text", "")
                    if not raw_text:
                        continue
                    speaker_label = fm.get("speaker_label")
                    ts_start_ms = _as_int(fm.get("ts_start_ms"))
                    ts_end_ms   = _as_int(fm.get("ts_end_ms"))

                    row_payload: Dict[str, Any] = {
                        "recording_session_id": session_id,
                        "raw_text": raw_text,
                    }
                    if speaker_label and hasattr(models.RecordingResult, "speaker_label"):
                        row_payload["speaker_label"] = speaker_label
                    if hasattr(models.RecordingResult, "started_at"):
                        # ✅ 상대 ms(세션 시작 기준) → 절대 시각 보정
                        row_payload["started_at"] = _ms_rel_or_abs_to_dt(ts_start_ms, dt_started)
                    if hasattr(models.RecordingResult, "ended_at"):
                        # ✅ 상대 ms(세션 시작 기준) → 절대 시각 보정
                        row_payload["ended_at"] = _ms_rel_or_abs_to_dt(ts_end_ms, dt_started)
 

                    batch_results.append(models.RecordingResult(**row_payload))

                if batch_results:
                    db.add_all(batch_results)
                    logger.info("🧾 Inserted %d RecordingResult rows (sid=%s)", len(batch_results), sid)
            else:
                logger.info("ℹ️ models.RecordingResult not found; skip segments ingestion")

            # 3-3) summaries → Summary/RecordingSummary 등 (존재하는 모델만 선택 적용)
            summary_model = None
            if hasattr(models, "Summary"):
                summary_model = models.Summary
            elif hasattr(models, "RecordingSummary"):
                summary_model = models.RecordingSummary

            if summary_model:
                batch_summaries = []
                for _id, data in sum_entries:
                    fm = _bmap2s(data)
                    summary_text = fm.get("summary_text")
                    if not summary_text:
                        continue

                    st_ms = _as_int(fm.get("interval_start_ms"))
                    en_ms = _as_int(fm.get("interval_end_ms"))
                    model_name   = fm.get("model")
                    tokens_in    = _as_int(fm.get("tokens_input"))
                    tokens_out   = _as_int(fm.get("tokens_output"))
                    source_text  = fm.get("source_text")

                    row_payload: Dict[str, Any] = {
                        "recording_session_id": session_id,
                    }

                    # 존재하는 칼럼만 매핑
                    if hasattr(summary_model, "summary_type"):
                        row_payload["summary_type"] = "interval"
                    if hasattr(summary_model, "content"):
                        row_payload["content"] = summary_text
                    if hasattr(summary_model, "interval_start_at"):
                        row_payload["interval_start_at"] = _ms_rel_or_abs_to_dt(st_ms, dt_started)
                    if hasattr(summary_model, "interval_end_at"):
                        row_payload["interval_end_at"] = _ms_rel_or_abs_to_dt(en_ms, dt_started)
                    if hasattr(summary_model, "model") and model_name:
                        row_payload["model"] = model_name
                    if hasattr(summary_model, "tokens_input") and tokens_in is not None:
                        row_payload["tokens_input"] = tokens_in
                    if hasattr(summary_model, "tokens_output") and tokens_out is not None:
                        row_payload["tokens_output"] = tokens_out
                    if hasattr(summary_model, "source_text") and source_text:
                        row_payload["source_text"] = source_text

                    batch_summaries.append(summary_model(**row_payload))

                if batch_summaries:
                    db.add_all(batch_summaries)
                    logger.info("🧾 Inserted %d summary rows (sid=%s)", len(batch_summaries), sid)
            else:
                logger.info("ℹ️ No summary model found; skip summaries ingestion")

            db.commit()
            logger.info("✅ Ingest committed (sid=%s)", sid)

        except Exception as e:
            db.rollback()
            logger.exception("❌ Ingest failed (sid=%s): %s", sid, e)
            raise

    return session_id
