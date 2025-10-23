from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, UTC
from sqlalchemy.orm import joinedload # 🍒 10.22 front 추가

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
    db: Session = Depends(get_db),   # ✅ 이렇게 파라미터로 받아야 함
):
    # 활성 구독 중 최신(시작일 기준) 1건 조회
    from sqlalchemy import desc
    active_sub = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))  # 🍒 10.22 front 추가
        .filter(
            Subscription.user_id == current_user.id,
            Subscription.is_active == True,
        )
        .order_by(desc(Subscription.start_date))   # 필요 시 기준 변경 가능
        .first()
    )

    # Plan.name 이 Enum(PlanType)이면 .value 로 문자열 뽑기
    plan_name = (
        active_sub.plan.name.value
        if active_sub and active_sub.plan
        else "free" # 🍒 10.22 front None -> "free" 로변경 [만약 플랜이없으면 free로가라]
    )

    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "nickname": current_user.nickname,
        "picture": current_user.picture,
        "oauth_provider": current_user.oauth_provider,
        "is_active": current_user.is_active,
        "role" : current_user.role,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "plan_name": plan_name,
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