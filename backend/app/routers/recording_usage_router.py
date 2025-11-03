# backend/app/routers/recording_router.py (발췌)
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from datetime import date
from backend.app.db import get_db
from backend.app.deps.auth import get_current_user
from backend.app.model import User
from backend.app.schemas.recording_usage_schema import RecordingUseRequest, RecordingUseResponse
from backend.app.crud import recording_usage_crud

router = APIRouter(prefix="/recordings/usage", tags=["recordings"])

@router.post("/use/{audio_id}", response_model=RecordingUseResponse, summary="사용량 소모")
def use_by_audio_owner(
    audio_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # 필요 없으면 제거 가능
):
    try:
        usage = recording_usage_crud.use_seconds_from_audio_owner(db, audio_id)
    except recording_usage_crud.UsageExceededError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    remaining = (
        "unlimited"
        if usage.allocated_seconds is None
        else max(int(usage.allocated_seconds) - int(usage.used_seconds or 0), 0)
    )

    # owner의 usage를 차감하므로, 응답 user_id는 owner_id가 됨
    return RecordingUseResponse(
        user_id=usage.user_id,
        used_seconds=int(usage.used_seconds or 0),
        remaining_seconds=remaining,
        allocated_seconds=None if usage.allocated_seconds is None else int(usage.allocated_seconds),
        period_end=usage.period_end,
    )

@router.get("/", response_model=RecordingUseResponse, summary="사용량 조회")
def get_current_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    usage = (
        db.query(recording_usage_crud.RecordingUsage)
        .filter(
            recording_usage_crud.RecordingUsage.user_id == current_user.id,
            (recording_usage_crud.RecordingUsage.period_end == None)
            | (recording_usage_crud.RecordingUsage.period_end >= date.today()),
        )
        .order_by(recording_usage_crud.RecordingUsage.created_at.desc())
        .first()
    )
    if not usage:
        raise HTTPException(status_code=404, detail="No active recording usage found")

    if usage.allocated_seconds is None:
        remaining = "unlimited"
    else:
        remaining = max(int(usage.allocated_seconds) - int(usage.used_seconds or 0), 0)

    return RecordingUseResponse(
        user_id=current_user.id,
        used_seconds=int(usage.used_seconds or 0),
        remaining_seconds=remaining,
        allocated_seconds=None if usage.allocated_seconds is None else int(usage.allocated_seconds),
        period_end=usage.period_end,
    )

@router.get("/total", summary="모든 사용량 조회")
def get_total_usage(db: Session = Depends(get_db)):
    total = recording_usage_crud.get_total_usage_all_users(db)
    return {"total_seconds": int(total)}

@router.get("/total/today", summary="오늘 사용량 조회")
def read_total_usage_today(db: Session = Depends(get_db)):
    return recording_usage_crud.get_total_usage_today(db)

@router.get("/total/7d", summary="7일간 사용량 조회")
def read_total_usage_7d(db: Session = Depends(get_db)):
    return recording_usage_crud.get_total_usage_last_7_days(db)

@router.get("/total/month", summary="한 달간 사용량 조회")
def read_total_usage_month(db: Session = Depends(get_db)):
    return recording_usage_crud.get_total_usage_month(db)

@router.get("/total/year", summary="1년간 사용량 조회")
def read_total_usage_year(db: Session = Depends(get_db)):
    return recording_usage_crud.get_total_usage_year(db)

@router.get("/compare", summary="사용량 비교")
def read_usage_comparisons(db: Session = Depends(get_db)):
    return recording_usage_crud.get_usage_comparisons(db)

@router.get("/avg", summary="플랜별 사용량 평균")
def read_avg_usage_by_plan(db: Session = Depends(get_db)):
    data = recording_usage_crud.get_avg_usage_by_plan(db)
    return {"plans": data}
