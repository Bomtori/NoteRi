from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session,joinedload 
from datetime import datetime, UTC
from sqlalchemy import desc, Enum
from datetime import date
from backend.app.deps.auth import get_current_user
from backend.app.model import User, Subscription, Plan
from backend.app.db import get_db
from backend.app.schemas import user_schema
import os

router = APIRouter()

# 📌 Pydantic 모델 정의

# ✅ 사용자 정보 조회 (GET)
@router.get("/users/me", response_model=user_schema.UserResponse)
async def get_user_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1) 최신 구독 1건(활성 여부로 미리 거르지 않음: 가장 최신 상태 판단이 중요)
    latest_sub: Subscription | None = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(Subscription.user_id == current_user.id)
        .order_by(desc(Subscription.start_date).nullslast())
        .first()
    )

    # 2) 기본값 = free
    effective_plan_name = "free"

    if latest_sub:
        # 만료/비활성 판단
        expired = bool(latest_sub.end_date and latest_sub.end_date < date.today())
        inactive = not latest_sub.is_active

        if not expired and not inactive and latest_sub.plan:
            # Plan.name 이 Enum일 수도 있으니 안전하게 문자열로
            raw_name = latest_sub.plan.name
            if isinstance(raw_name, Enum):  # e.g. PlanType.PRO
                effective_plan_name = raw_name.value.lower()
            else:
                effective_plan_name = str(raw_name).lower()

    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "nickname": current_user.nickname,
        "picture": current_user.picture,
        "oauth_provider": current_user.oauth_provider,
        "is_active": current_user.is_active,
        "role": current_user.role,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        # ✅ 만료/비활성 시 자동으로 "free"
        "plan_name": effective_plan_name,
    }


# ✅ 사용자 정보 수정 (PATCH)
@router.patch("/users/me")
async def update_user(
    data: user_schema.UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if data.name is not None:
        current_user.name = data.name
    if data.nickname is not None:
        current_user.nickname = data.nickname
    if data.picture is not None:
        current_user.picture = data.picture

    current_user.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(current_user)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "nickname": current_user.nickname,
        "picture": current_user.picture
    }

# ✅ 사용자 탈퇴 (soft delete)
@router.delete("/users/me")
async def delete_user(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.is_active = False
    current_user.updated_at = datetime.now(UTC)
    for board in current_user.boards:
        db.delete(board)
    db.commit()



    return {"message": "User deactivated"}

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)