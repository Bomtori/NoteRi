from __future__ import annotations
from typing import Literal, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

# 공통 필드
class SummaryBase(BaseModel):
    summary_type: Optional[str] = Field(None, description="'interval' | 'final' 등 자유 텍스트")
    content: str
    interval_start_at: Optional[datetime] = None
    interval_end_at: Optional[datetime] = None
    model: Optional[str] = None
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None

class SummaryUpdate(BaseModel):
    summary_type: Optional[str] = None
    content: Optional[str] = None
    interval_start_at: Optional[datetime] = None
    interval_end_at: Optional[datetime] = None
    model: Optional[str] = None
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None

class SummaryResponse(SummaryBase):
    id: int
    recording_session_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # Pydantic v2

class SummaryListResponse(BaseModel):
    summaries: List[SummaryResponse]
