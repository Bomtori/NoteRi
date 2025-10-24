# backend/app/tasks/final_summary.py
from __future__ import annotations
from typing import Sequence, Optional
from sqlalchemy.orm import Session
from sqlalchemy import insert
from backend.app.db import SessionLocal
from backend.app import model as m
from backend.app.util.llm_client import ollama_summarize_json
from backend.ml.postprocess.text_cleaner import normalize_transcript_lines, TextCleaner

async def build_final_summary(all_lines: Sequence[str]) -> dict:
    """
    전체 문장 -> 전처리 -> Qwen 요약(JSON)
    """
    cleaned_lines = normalize_transcript_lines(all_lines, cleaner=TextCleaner())
    if not cleaned_lines:
        return {"title": "요약할 내용이 없습니다.", "bullets": [], "actions": []}
    body = "\n".join(cleaned_lines)
    return await ollama_summarize_json(body)

def persist_final_summary(
    recording_session_id: int,
    summary_json: dict,
    raw_text: Optional[str] = None,
) -> None:
    """
    DB에 summaries row 저장
    - summary_type='final'
    - title/bullets/actions 컬럼이 없다면, content(JSON) 하나로 저장하도록 아래 주석처럼 바꿔도 됨.
    """
    db: Session = SessionLocal()
    try:
        if hasattr(m, "Summary"):
            s = m.Summary(
                recording_session_id=recording_session_id,
                summary_type="final",
                title=summary_json.get("title"),
                bullets=summary_json.get("bullets"),
                actions=summary_json.get("actions"),
                raw_text=raw_text,
            )
            db.add(s)
        else:
            # 스키마에 따라 content 하나로 저장하고 싶다면:
            # payload = {
            #     "recording_session_id": recording_session_id,
            #     "summary_type": "final",
            #     "content": summary_json,
            #     "raw_text": raw_text,
            # }
            tbl = getattr(m, "summaries")
            payload = {
                "recording_session_id": recording_session_id,
                "summary_type": "final",
                "title": summary_json.get("title"),
                "bullets": summary_json.get("bullets"),
                "actions": summary_json.get("actions"),
                "raw_text": raw_text,
            }
            db.execute(insert(tbl).values(**payload))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
