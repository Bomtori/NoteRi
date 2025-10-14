# backend/app/routers/ai_router.py
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from backend.app.util.gemini_client import generate_text

router = APIRouter(prefix="/ai", tags=["ai"])

class ChatIn(BaseModel):
    prompt: str = Field(..., min_length=1)
    temperature: float = 0.3
    max_output_tokens: int = 256

@router.post("/chat")
def chat(inb: ChatIn, debug: bool = Query(False)):
    try:
        text, meta = generate_text(
            inb.prompt,
            temperature=inb.temperature,
            max_output_tokens=inb.max_output_tokens,
        )
        return {"text": text, "meta": meta, "empty": (text.strip() == "")}
    except Exception as e:
        # 절대 500 내지 않게, 프론트에서 처리 가능한 형태로 반환
        return {"text": "", "meta": {"api": "router", "error": str(e)}, "empty": True}
