# backend/app/routers/ai_history_router.py
from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, and_, func
from sqlalchemy.orm import Session

# 프로젝트 공용 의존성들 (프로젝트 경로에 맞게 import 수정)
from backend.app.db import get_db                # SQLAlchemy Session 제공 함수
from backend.app.model import AIGemini  # 앞서 만든 로그 모델
from backend.app.deps.auth import get_current_user    # 현재 사용자 객체 가져오는 의존성 (없다면 user_id를 파라미터로 대체)

router = APIRouter(prefix="/ai/history", tags=["ai-history"])

# ---------------------------
# Pydantic Schemas
# ---------------------------
class ChatItem(BaseModel):
    id: int
    created_at: datetime
    model: str
    api_path: str
    status: str
    prompt_text: str | None = None
    response_text: str | None = None
    empty: bool

class ChatListResponse(BaseModel):
    items: List[ChatItem]
    next_cursor: str | None = Field(
        default=None,
        description="다음 페이지를 위한 커서(ISO8601). 없으면 마지막 페이지.",
    )
    total_count: Optional[int] = Field(default=None, description="옵션: 전체 개수(요청 시에만 계산)")

# ---------------------------
# 유틸
# ---------------------------
def _truncate(s: Optional[str], limit: int) -> Optional[str]:
    if not s:
        return s
    s = s.strip()
    return (s[:limit] + "…") if len(s) > limit else s
