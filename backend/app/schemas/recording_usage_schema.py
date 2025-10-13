# backend/app/schemas/recording.py
from datetime import date
from pydantic import BaseModel, Field
from typing import Optional, Literal


class RecordingUseRequest(BaseModel):
    duration_minutes: int = Field(..., gt=0, description="녹음 길이(분 단위)")
    # 선택: 어떤 세션/보드에서 사용되었는지 로깅하고 싶으면 사용
    session_id: Optional[int] = None
    board_id: Optional[int] = None


RemainingType = Literal["unlimited"] | int


class RecordingUseResponse(BaseModel):
    user_id: int
    used_minutes: Optional[int]
    remaining_minutes: RemainingType
    allocated_minutes: Optional[int]
    period_end: Optional[date]
