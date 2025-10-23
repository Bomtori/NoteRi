# backend/app/schemas/recording_usage_schema.py
from pydantic import BaseModel
from typing import Optional
from datetime import date

class RecordingUseRequest(BaseModel):
    duration_seconds: int
    session_id: Optional[int] = None
    board_id: Optional[int] = None

class RecordingUseResponse(BaseModel):
    user_id: int
    used_seconds: int
    remaining_seconds: int | str   # "unlimited" 가능
    allocated_seconds: Optional[int] = None
    period_end: Optional[date] = None
