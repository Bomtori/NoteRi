from typing import Sequence, Optional
from sqlalchemy.orm import Session
from sqlalchemy import insert
from backend.app.db import SessionLocal
from backend.app import model as m
from backend.app.util.llm_client import ollama_summarize_json
import asyncio

def clean_lines(lines: Sequence[str]) -> list[str]:
    import re
    fillers = r"(?:아+|어+|음+|에+|악+|흐+|하+|응+|헉+|아이+|ㅎㅎ+|ㅋㅋ+)"
    noise = re.compile(rf"(^\s*{fillers}\s*$)|(\([^)]+\))|(\[[^\]]+\])")
    out = []
    for ln in lines:
        ln = noise.sub("", ln).strip()
        if not ln or len(ln) < 3:
            continue
        if re.search(r"(동해물과|만세)", ln):
            continue
        out.append(ln)
    return out

async def build_final_summary(all_lines: Sequence[str]) -> dict:
    """Qwen으로 전체 요약 생성"""
    lines = clean_lines(all_lines)
    if not lines:
        return {"title": "요약할 내용이 없습니다.", "bullets": [], "actions": []}
    body = "\n".join(lines)
    return await ollama_summarize_json(body)

def persist_final_summary(
    recording_session_id: int,
    summary_json: dict,
    raw_text: Optional[str] = None,
) -> None:
    """DB에 summaries row 저장"""
    db: Session = SessionLocal()
    try:
        # ORM 모델이 있을 경우 (ex: class Summary(Base))
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
            # Core fallback
            tbl = getattr(m, "summaries")
            db.execute(
                insert(tbl).values(
                    recording_session_id=recording_session_id,
                    summary_type="final",
                    title=summary_json.get("title"),
                    bullets=summary_json.get("bullets"),
                    actions=summary_json.get("actions"),
                    raw_text=raw_text,
                )
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
