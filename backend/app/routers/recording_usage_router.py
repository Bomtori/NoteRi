# routers/recording_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import date
from app.db import get_db
from app.deps.auth import get_current_user
from app.model import User
from app.crud import recording_usage_crud

router = APIRouter(prefix="/recordings", tags=["recordings"])


# ✅ 요청 모델
class RecordingUseRequest(BaseModel):
    duration_minutes: int = Field(..., gt=0, description="녹음 길이(분 단위)")

# ✅ 응답 모델
class RecordingUseResponse(BaseModel):
    user_id: int
    used_minutes: int | None
    remaining_minutes: int | str
    allocated_minutes: int | None
    period_end: date | None


# ✅ 녹음 minutes 차감 API
@router.post("/use", response_model=RecordingUseResponse)
def use_recording_minutes(
    req: RecordingUseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    녹음 종료 후 minutes만큼 사용량 차감.
    enterprise/free → 무제한이라 차감 안함.
    """
    try:
        usage = recording_usage_crud.use_minutes(db, current_user.id, req.duration_minutes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # ✅ 남은 minutes 계산
    if usage.allocated_minutes is None:
        remaining = "unlimited"
    else:
        remaining = max(usage.allocated_minutes - usage.used_minutes, 0)

    return RecordingUseResponse(
        user_id=current_user.id,
        used_minutes=usage.used_minutes,
        remaining_minutes=remaining,
        allocated_minutes=usage.allocated_minutes,
        period_end=usage.period_end,
    )
