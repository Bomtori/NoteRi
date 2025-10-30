# backend/app/tasks/final_summary.py
from __future__ import annotations
from typing import Sequence, Optional
from sqlalchemy.orm import Session
from backend.app.db import SessionLocal
from backend.app import model as m
from backend.app.util.llm_client import ollama_summarize_json  # 이미 만든 Qwen 클라이언트 사용
import logging
from sqlalchemy import asc

logger = logging.getLogger("FinalSummary")

def _merge_lines(lines: Sequence[str]) -> str:
    # 라인들을 적당히 합쳐 문서체에 가깝게(과한 전처리 없이)
    parts = [ln.strip() for ln in lines if ln and ln.strip()]
    return "\n".join(parts)

async def build_final_summary_from_lines(all_lines: Sequence[str]) -> dict:
    """
    세션 종료 시 메모리 버퍼(문장들) → Qwen 요약(JSON)
    """
    body = _merge_lines(all_lines)
    if not body:
        return {"title": "요약할 내용이 없습니다.", "bullets": [], "actions": []}
    return await ollama_summarize_json(body)

def fetch_lines_from_db(recording_session_id: int) -> list[str]:
    """
    in-memory 라인이 비어 있을 때를 대비한 대체 경로:
    recording_results.raw_text 를 시간순으로 모아 라인 배열로 제공
    """
    db: Session = SessionLocal()
    try:
        from backend.app import model as m
        rows = (
            db.query(m.RecordingResult.raw_text)
              .filter(m.RecordingResult.recording_session_id == recording_session_id)
              .order_by(asc(m.RecordingResult.started_at))
              .all()
        )
        # r은 튜플 (예: ('문장',)) 형태로 오므로 r[0]으로 추출
        return [r[0] for r in rows if r and r[0]]
    finally:
        db.close()

def persist_final_summary(
    recording_session_id: int,
    summary_json: dict,
    raw_text: Optional[str] = None,
) -> None:
    """
    final_summaries 테이블에 1건 저장
    """
    db: Session = SessionLocal()
    try:
        row = m.FinalSummary(
            recording_session_id=recording_session_id,
            title=summary_json.get("title"),
            bullets=summary_json.get("bullets"),
            actions=summary_json.get("actions"),
            content=raw_text,
        )
        db.add(row)
        db.commit()
        logger.info("🧾 Final summary saved.")
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Final summary save failed: {e}")
        raise
    finally:
        db.close()
