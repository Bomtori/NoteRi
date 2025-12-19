from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.app.util.llm_client import ollama_generate_template

router = APIRouter(prefix="/ollama", tags=["ollama-template"])


# 요청 데이터 구조 정의
class TemplateRequest(BaseModel):
    type: str                     # lecture / meeting / interview / blog
    summaries: list | None = []   # 요약본
    refinedScript: list | None = []  # 정제된 STT 스크립트
    memo: dict | None = {}           # 사용자 메모


# 실제 템플릿 생성 엔드포인트
@router.post("/template")
async def generate_template(req: TemplateRequest):
    try:
        result = await ollama_generate_template(
            template_type=req.type,
            summaries=req.summaries or [],
            script=req.refinedScript or [],
            memo=req.memo or {},
        )
        return {"template": result}

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template generation failed: {e}")
