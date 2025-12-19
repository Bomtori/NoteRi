from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session,joinedload 
from datetime import datetime, UTC
from sqlalchemy import desc, Enum
from datetime import date
from backend.app.deps.auth import get_current_user
from backend.app.deps.guest import get_principal
from backend.app.model import User, Subscription, Plan
from backend.app.db import get_db
from backend.app.schemas import user_schema
import os, random
from urllib.parse import urlparse

router = APIRouter()
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:8000")
DEFAULT_PROFILE_CANDIDATES = [
    "/static/uploads/Group_48.png",
    "/static/uploads/Group_49.png",
]
DEFAULT_PROFILE_URL = f"{APP_BASE_URL}{DEFAULT_PROFILE_CANDIDATES}"

# 사용자 정보 조회 (GET)
@router.get("/users/me", response_model=user_schema.UserResponse, summary="사용자 본인 정보 조회")
async def get_user_me(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1) 최신 구독 1건
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
        expired = bool(latest_sub.end_date and latest_sub.end_date < date.today())
        inactive = not latest_sub.is_active

        if not expired and not inactive and latest_sub.plan:
            raw_name = latest_sub.plan.name
            if isinstance(raw_name, Enum):
                effective_plan_name = raw_name.value.lower()
            else:
                effective_plan_name = str(raw_name).lower()

    # ✅ 프로필 사진이 없는 유저라면: 한 번 랜덤으로 정해서 DB에 저장
    if not current_user.picture:
        chosen_rel_path = random.choice(DEFAULT_PROFILE_CANDIDATES)

        user_in_db = db.query(User).filter(User.id == current_user.id).first()
        if user_in_db:
            user_in_db.picture = chosen_rel_path          # ← 상대 경로로 저장
            db.commit()
            db.refresh(user_in_db)
            current_user = user_in_db

    pic = current_user.picture

    # 2️⃣ 예전에 저장된 절대 URL( http://1.236... )을 상대경로로 자동 정리
    if pic and pic.startswith("http"):
        parsed = urlparse(pic)
        # 예: http://1.236.171.160:8000/static/uploads/xxx.png → /static/uploads/xxx.png
        pic = parsed.path  

    # 3️⃣ 최종 응답용 URL 만들기 (항상 HTTPS 도메인 사용)
    rel_path = pic or random.choice(DEFAULT_PROFILE_CANDIDATES)
    picture_url = f"{APP_BASE_URL}{rel_path}"

    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "nickname": current_user.nickname,
        "picture": picture_url,   # ✅ 항상 https://... 로 나감
        "oauth_provider": current_user.oauth_provider,
        "is_active": current_user.is_active,
        "role": current_user.role,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "plan_name": effective_plan_name,
    }


# 사용자 정보 수정
@router.patch("/users/me", summary="사용자 정보 수정")
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

# 사용자 탈퇴 (soft delete)
@router.delete("/users/me", summary="사용자 탈퇴")
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