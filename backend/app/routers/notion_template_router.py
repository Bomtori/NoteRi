from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Literal


from backend.app.db import SessionLocal
from backend.services.notion_template import build_notion_markdown, TemplateType
from backend.app.deps.auth import get_current_user # 기존 프로젝트의 인증 의존성에 맞춰 조정
import httpx


router = APIRouter(prefix="/notion", tags=["notion-template"])




class RenderRequest(BaseModel):
    session_id: int
    template: TemplateType = Field(description="script | minutes | final")




class UploadRequest(RenderRequest):
    parent_id: str = Field(description="Notion parent database/page id")
    parent_type: Literal["database", "page"] = "database"
    page_title: str | None = None




async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()




@router.post("/render")
async def render_for_notion(req: RenderRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """세션에서 소스 데이터를 읽어 Markdown 템플릿(본문)만 생성해서 반환."""
    try:
        doc = await build_notion_markdown(db, session_id=req.session_id, template=req.template)
        return {"ok": True, **doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"render failed: {e}")




@router.post("/upload_template")
async def upload_template(req: UploadRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    템플릿을 서버에서 즉시 업로드까지 수행.
    - 이미 프로젝트에 /notion/upload 가 있다면 그 엔드포인트로 프록시 호출하여 일관성 유지.
    """
    doc = await build_notion_markdown(db, session_id=req.session_id, template=req.template)
    title = req.page_title or doc.get("title") or "회의 템플릿"


    # 프로젝트의 기존 업로드 라우트를 내부 HTTP로 재사용 (권장)
    payload = {
        "title": title,
        "content": doc["content"],
        "parent_id": req.parent_id,
        "parent_type": req.parent_type,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        # 같은 FastAPI 앱의 라우터를 직접 호출하려면, 별도 서비스 함수로 분리하는 편이 더 깔끔하다.
        # 여기서는 기존 프론트가 사용하는 /notion/upload 에 위임한다고 가정한다.
        r = await client.post("http://localhost:8000/notion/upload", json=payload)
        r.raise_for_status()
        data = r.json()
    return {"ok": True, "title": title, "url": data.get("url"), "meta": doc.get("raw")}