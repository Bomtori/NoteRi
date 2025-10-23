# backend/app/routers/recording_router.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional, Literal

from backend.app.db import get_db
# 권장: auth_crud 버전 사용 (토큰 검증 통일)
from backend.app.deps.auth import get_current_user
from backend.app.model import User
from backend.app.schemas.recording_usage_schema import (
    RecordingUseRequest,
    RecordingUseResponse,
)
from backend.app.crud import recording_usage_crud

router = APIRouter(prefix="/recordings", tags=["recordings"])


@router.post("/use", response_model=RecordingUseResponse)
def use_recording_minutes(
    req: RecordingUseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    녹음 종료 후 minutes만큼 사용량 차감.
    - Enterprise/무제한은 차감하지 않고 현재 상태만 반환
    - 유한 플랜은 초과 시 400 에러
    - 선택적으로 session_id / board_id 로깅 지원 (crud에서 사용 시)
    """
    try:
        # crud.use_minutes가 session_id/board_id를 받을 수 있다면 그대로 전달
        # (앞서 제가 제안했던 로그 테이블에 맞춰 확장 가능)
        try:
            usage = recording_usage_crud.use_minutes(
                db,
                current_user.id,
                req.duration_minutes,
                session_id=req.session_id,
                board_id=req.board_id,
            )
        except TypeError:
            # 기존 시그니처(파라미터 3개)와도 호환
            usage = recording_usage_crud.use_minutes(
                db,
                current_user.id,
                req.duration_minutes,
            )
    except recording_usage_crud.UsageExceededError as e:  # 초과 사용
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:  # 잘못된 입력 등
        raise HTTPException(status_code=400, detail=str(e))

    # 남은 minutes 계산
    if usage.allocated_minutes is None:
        remaining: int | str = "unlimited"
    else:
        remaining = max(int(usage.allocated_minutes) - int(usage.used_minutes or 0), 0)

    return RecordingUseResponse(
        user_id=current_user.id,
        used_minutes=usage.used_minutes,
        remaining_minutes=remaining,
        allocated_minutes=usage.allocated_minutes,
        period_end=usage.period_end,
    )


# 현재 사용량 요약 조회 (프론트에서 상태 뱃지용)
@router.get("/usage", response_model=RecordingUseResponse)
def get_current_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    오늘 기준 유효한 RecordingUsage 1개를 조회해 요약을 반환합니다.
    (없으면 404)
    """
    usage = (
        db.query(recording_usage_crud.RecordingUsage)  # 필요 시 model에서 직접 import해도 됩니다
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

    if usage.allocated_minutes is None:
        remaining: int | str = "unlimited"
    else:
        remaining = max(int(usage.allocated_minutes) - int(usage.used_minutes or 0), 0)

    return RecordingUseResponse(
        user_id=current_user.id,
        used_minutes=usage.used_minutes,
        remaining_minutes=remaining,
        allocated_minutes=usage.allocated_minutes,
        period_end=usage.period_end,
    )

@router.get("/total")
def get_total_usage(db: Session = Depends(get_db)):
    total = recording_usage_crud.get_total_usage_all_users(db)
    return {"total": total}

@router.get("/total/today")
def read_total_usage_today(db: Session = Depends(get_db)):
    return recording_usage_crud.get_total_usage_today(db)

@router.get("/total/7d")
def read_total_usage_7d(db: Session = Depends(get_db)):
    return recording_usage_crud.get_total_usage_last_7_days(db)


@router.get("/total/month")
def read_total_usage_month(db: Session = Depends(get_db)):
    return recording_usage_crud.get_total_usage_month(db)


@router.get("/total/year")
def read_total_usage_year(db: Session = Depends(get_db)):
    return recording_usage_crud.get_total_usage_year(db)

@router.get("/compare")
def read_usage_comparisons(db: Session = Depends(get_db)):
    """
    전일/전주/전월/전년 대비 총 사용량 증감 요약
    """
    return recording_usage_crud.get_usage_comparisons(db)

@router.get("/avg")
def read_avg_usage_by_plan(db: Session = Depends(get_db)):
    """
    free / pro / enterprise 별 평균 사용시간 분석
    """
    data = recording_usage_crud.get_avg_usage_by_plan(db)
    return {"plans": data}