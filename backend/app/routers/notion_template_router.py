from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, Literal

from backend.app.db import SessionLocal
from backend.app.deps.auth import get_current_user
from backend.services.notion_template import build_notion_markdown, TemplateType
from backend.app.model import RecordingSession, Board, BoardShare
from backend.app.routers.notion_auth_router import upload_to_notion
import httpx
import os

router = APIRouter(prefix="/notion", tags=["notion-template"])

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class RenderRequest(BaseModel):
    session_id: Optional[int] = None
    board_id: Optional[int] = None
    ui_type: Literal["회의기록", "스크립트", "전체요약"] = Field(default="회의기록")

class UploadRequest(RenderRequest):
    parent_id: str = Field(description="Notion parent database/page id")
    parent_type: Literal["database", "page"] = "database"
    page_title: Optional[str] = None
    content_override: Optional[str] = None

# 유틸: 접근 가능 세션 resolve
def resolve_session_or_404(db: Session, user_id: int, session_id: Optional[int], board_id: Optional[int]) -> RecordingSession:
    """
    1) session_id가 오면: 해당 세션이 현재 사용자에게 소유/공유 되었는지 검사 후 반환
    2) session_id가 없고 board_id만 오면: 해당 보드의 최신 세션 1개 반환
    """
    if session_id:
        # 해당 session이 유저에게 접근 가능한지 (boards.owner_id == user_id or shares 포함)
        q = (
            db.query(RecordingSession)
            .join(Board, RecordingSession.board_id == Board.id)
            .outerjoin(BoardShare, Board.id == BoardShare.board_id)
            .filter(RecordingSession.id == session_id)
            .filter((Board.owner_id == user_id) | (BoardShare.user_id == user_id))
        )
        rs = q.first()
        if not rs:
            raise HTTPException(status_code=404, detail="session not found or no permission")
        return rs

    if board_id:
        q = (
            db.query(RecordingSession)
            .join(Board, RecordingSession.board_id == Board.id)
            .outerjoin(BoardShare, Board.id == BoardShare.board_id)
            .filter(Board.id == board_id)
            .filter((Board.owner_id == user_id) | (BoardShare.user_id == user_id))
            .order_by(RecordingSession.started_at.desc())
        )
        rs = q.first()
        if not rs:
            raise HTTPException(status_code=404, detail="no sessions found for this board or no permission")
        return rs

    raise HTTPException(status_code=400, detail="session_id or board_id is required")

# UI 타입 → 템플릿 타입 매핑
def map_ui_to_template(ui_type: str) -> TemplateType:
    # TemplateType = Literal["script", "minutes", "final"] 라고 가정
    if ui_type == "회의기록":
        return "minutes"
    if ui_type == "스크립트":
        return "script"
    if ui_type == "전체요약":
        return "final"
    return "minutes"

# Qwen(또는 Ollama)로 Markdown 다듬기 (선택
async def polish_with_llm(markdown: str) -> str:
    base = os.getenv("OLLAMA_BASE_URL")
    model = os.getenv("OLLAMA_MODEL")
    if not base or not model:
        return markdown 

    prompt = f"""다음 회의록 Markdown을 더 읽기 좋게 정리해줘.
- 제목과 소제목을 구조화하고
- bullet/numbering을 명확화
- 중요 포인트는 굵게 표시
- 표가 필요하면 Markdown 표로

[원본]
{markdown}
"""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{base}/api/generate", json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.2, "num_ctx": 4096}
            })
            r.raise_for_status()
            return (r.json().get("response") or "").strip() or markdown
    except Exception:
        return markdown

# 미리보기: 노션 업로드 전 Markdown/JSON 생성
@router.post("/render")
async def render_for_notion(req: RenderRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    rs = resolve_session_or_404(db, user_id=user.id, session_id=req.session_id, board_id=req.board_id)
    template: TemplateType = map_ui_to_template(req.ui_type)

   
    doc = await build_notion_markdown(db, session_id=rs.id, template=template)

    polished = await polish_with_llm(doc["content"])

    return {
        "ok": True,
        "session_id": rs.id,
        "board_id": rs.board_id,
        "title": doc.get("title") or "회의 템플릿",
        "content_markdown": polished,
        "content_markdown_raw": doc["content"], 
        "content_json": doc.get("raw")          
    }

# 업로드: 바로 노션으로 
@router.post("/upload_template")
async def upload_template(req: UploadRequest, request: Request, db: Session = Depends(get_db), user=Depends(get_current_user)):
    rs = resolve_session_or_404(db, user_id=user.id, session_id=req.session_id, board_id=req.board_id)
    template: TemplateType = map_ui_to_template(req.ui_type)
    auth_header = request.headers.get("authorization")
    if req.content_override:
        title = req.page_title or "회의 템플릿"
        content = req.content_override
    else:
        doc = await build_notion_markdown(db, session_id=rs.id, template=template)
        title = req.page_title or (doc.get("title") or "회의 템플릿")
        content = await polish_with_llm(doc["content"])

    # 이미 존재하는 /notion/upload 엔드포인트를 프록시 호출 (프로젝트 일관성 유지)
    payload = {
        "title": title,
        "content": content,
        "parent_id": req.parent_id,
        "parent_type": req.parent_type,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post("http://localhost:8000/notion/upload", json=payload, headers={"Authorization": auth_header} if auth_header else None)
        r.raise_for_status()
        data = r.json()

    return {"ok": True, "url": data.get("url"), "title": title}
