# app/crud/ai_log_crud.py
from sqlalchemy.orm import Session
from uuid import uuid4
from backend.app.model import AIGemini

def save_ai_interaction(
    db: Session,
    *,
    user_id: int | None,
    model: str,
    api_path: str,
    status: str,
    latency_ms: int | None,
    prompt_text: str | None,
    response_text: str | None,
    input_tokens: int | None,
    output_tokens: int | None,
    finish_reason: str | None,
    safety: dict | None,
    meta: dict | None,
    is_sampled: bool = True,
) -> AIGemini:
    row = AIGemini(
        user_id=user_id,
        request_id=uuid4().hex,
        model=model,
        api_path=api_path,
        status=status,
        latency_ms=latency_ms,
        prompt_text=prompt_text,
        response_text=response_text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        finish_reason=finish_reason,
        safety=safety,
        meta=meta,
        is_sampled=is_sampled,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
