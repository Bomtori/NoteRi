# backend/app/schemas/final_summary.py
from __future__ import annotations
from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel


class FinalSummaryResponse(BaseModel):
    id: int
    recording_session_id: int
    title: Optional[str] = None
    bullets: Optional[List[Any]] = None   # JSON 컬럼: 문자열 리스트/사전 혼합 가능성 고려
    actions: Optional[List[Any]] = None   # JSON 컬럼
    content: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FinalSummaryListResponse(BaseModel):
    board_id: int
    session_id: int
    total: int
    items: List[FinalSummaryResponse]
