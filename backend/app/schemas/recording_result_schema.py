# backend/app/schemas/recording_result.py
from __future__ import annotations
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel


class RecordingResultResponse(BaseModel):
    id: int
    recording_session_id: int
    speaker_label: Optional[str] = None
    raw_text: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RecordingResultListResponse(BaseModel):
    board_id: int
    session_id: int
    total: int
    items: List[RecordingResultResponse]
