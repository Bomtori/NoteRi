# backend/app/schemas/final_summary.py
from __future__ import annotations
from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, conint


class FinalSummaryResponse(BaseModel):
    id: int
    recording_session_id: int
    title: Optional[str] = None
    bullets: Optional[List[Any]] = None
    actions: Optional[List[Any]] = None
    content: Optional[str] = None
    rating: Optional[int] = None          # ✅ 추가
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FinalSummaryListResponse(BaseModel):
    board_id: int
    session_id: int
    total: int
    items: List[FinalSummaryResponse]

class FinalSummaryRatingUpdate(BaseModel):
    rating: conint(ge=1, le=5)  # 1~5만 허용