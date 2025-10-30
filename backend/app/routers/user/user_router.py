from fastapi import APIRouter, Depends, HTTPException, Path, status, Query
from datetime import datetime, timezone
from sqlalchemy.exc import NoResultFound
from sqlalchemy.orm import Session
from backend.app.crud import user_crud, admin_user_overview_crud
from backend.app.db import get_db
from backend.app.deps.auth import get_current_user
from backend.app.model import User, UserBanLog
from backend.app.schemas.admin_user_overview_schema import AdminUserOverview, AdminUserOverviewListResponse
from backend.app.schemas.user_schema import BanStatusResponse, BanUpdateRequest, UserMeResponse, BanInfoResponse
from backend.app.util.authz import require_admin

router = APIRouter(prefix="/users", tags=["Users"])

# 사용자 숫자 확인
@router.get("/count")
def get_user_count(db: Session = Depends(get_db)):
    total_users = user_crud.get_total_users_count(db)
    return {"total_users": total_users}

# 비활성 사용자 수 확인
@router.get("/count/noactive")
def get_user_count_no_active(db: Session = Depends(get_db)):
    no_active_users = user_crud.get_no_active_users_count(db)
    return {"no_active_users": no_active_users}

# OAuth 구분
@router.get("/count/provider")
def get_user_count_provider(db: Session = Depends(get_db)):
    return user_crud.get_user_count_by_provider(db)

# 오늘 가입자 수
@router.get("/count/signup/today")
def get_signup_today(db: Session = Depends(get_db)):
    return user_crud.get_user_signup_today_stats(db)

# 최근 일주일 가입자 수 추이
@router.get("/count/signup/last-7-days")
def signup_last_7_days(db: Session = Depends(get_db)):
    return user_crud.get_user_signup_last_7_days(db)

# 최근 5주간 가입자 수 추이
@router.get("/count/signup/last-5-weeks")
def signup_last_5_weeks(db: Session = Depends(get_db)):
    return user_crud.get_user_signup_last_5_weeks(db)

# 최근 6개월 간 가입자 수 추이
@router.get("/count/signup/last-6-months")
def signup_last_6_months(db: Session = Depends(get_db)):
    return user_crud.get_user_signup_last_6_months(db)

# 최근 5년간 가입자 수 추이
@router.get("/count/signup/last-5-years")
def signup_last_5_years(db: Session = Depends(get_db)):
    return user_crud.get_user_signup_last_5_years(db)

@router.get("/last-7d")
def last_7d(db: Session = Depends(get_db)):
    return {"total": user_crud.get_last_7d_signups(db)}

@router.get("/last-m")
def last_6m(db: Session = Depends(get_db)):
    print("한 달동안 가입자 수 ", user_crud.get_last_m_signups(db))
    return {"total": user_crud.get_last_m_signups(db)}

@router.get("/last-12m")
def last_12m(db: Session = Depends(get_db)):
    return {"total": user_crud.get_last_12m_signups(db)}

@router.get("/dod")
def dod(db: Session = Depends(get_db)):
    return user_crud.get_dod_signup_growth(db)

@router.get("/wow")
def wow(db: Session = Depends(get_db)):
    return user_crud.get_wow_signup_growth(db)

@router.get("/mom")
def mom(db: Session = Depends(get_db)):
    return user_crud.get_mom_signup_growth(db)

@router.get("/yoy")
def yoy(db: Session = Depends(get_db)):
    return user_crud.get_yoy_signup_growth(db)

@router.get("/away/count")
def get_inactive_stats(db: Session = Depends(get_db)):
    return user_crud.inactive_stats_last_6_months(db)

# 유저 밴 상태 수정
@router.patch("/{user_id}/ban", response_model=BanStatusResponse)
def update_ban_state(
    user_id: int = Path(..., ge=1),
    body: BanUpdateRequest = ...,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),  # ✅ 관리자만 허용
):
    try:
        updated = user_crud.set_ban_state(
            db,
            user_id,
            is_banned=body.is_banned,
            reason=body.reason,
            until=body.until,
            actor_id=admin.id,
        )
    except NoResultFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return BanStatusResponse(
        user_id=updated.id,
        is_banned=updated.is_banned,
        banned_reason=updated.banned_reason,
        banned_until=updated.banned_until,
    )

# 유저 밴 로그 조회
@router.get("/{user_id}/ban/logs")
def get_ban_logs(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    logs = (
        db.query(UserBanLog)
        .filter(UserBanLog.user_id == user_id)
        .order_by(UserBanLog.created_at.desc())
        .all()
    )
    return [
        {
            "id": log.id,
            "is_banned": log.is_banned,
            "reason": log.reason,
            "until": log.until,
            "actor_id": log.actor_id,
            "created_at": log.created_at,
        }
        for log in logs
    ]

# 유저가 본인의 밴 사유 확인
@router.get("/me/banned", response_model=UserMeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# 운영자가 보는 밴 사유
@router.get("/{user_id}/ban", response_model=BanInfoResponse)
def get_user_ban_info(
    user_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    admin = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # 남은 시간 계산
    remaining_seconds = None
    if user.is_banned:
        if user.banned_until is None:
            remaining_seconds = None  # 영구밴
        else:
            now = datetime.now(timezone.utc)
            diff = int((user.banned_until - now).total_seconds())
            remaining_seconds = max(diff, 0)

    return BanInfoResponse(
        user_id=user.id,
        is_banned=user.is_banned,
        banned_reason=user.banned_reason,
        banned_until=user.banned_until,
        remaining_seconds=remaining_seconds,
    )
