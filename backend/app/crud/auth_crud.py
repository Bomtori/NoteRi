from sqlalchemy.orm import Session
from datetime import datetime, UTC, date, timedelta
from fastapi.responses import JSONResponse
from fastapi import status
from backend.app.model import User, Subscription, Plan
from backend.app.util.auth import create_access_token


def get_or_create_user(
    db: Session,
    provider: str,
    sub: str,
    email: str,
    name: str,
    nickname: str,
    picture: str,
):
    """
    공통: OAuth 로그인한 유저 DB에 등록 (없으면 생성)
    - 탈퇴(is_active=False) 계정이 있으면 재활성화
    """
    # 1) provider + sub 기준으로 기존 유저 찾기
    db_user = db.query(User).filter(
        User.oauth_provider == provider,
        User.oauth_sub == sub
    ).first()
    free_plan = db.query(Plan).filter(Plan.name == "free").first()
    # 2) 없는 경우 (처음 로그인)
    if not db_user:
        # 혹시 같은 email인데 탈퇴 상태(is_active=False)인지 확인
        user = db.query(User).filter(
            User.email == email,
            User.oauth_provider == provider
        ).first()

        # ✅ 완전히 새 계정 생성
        db_user = User(
            email=email,
            name=name,
            nickname=nickname,
            picture=picture,
            oauth_provider=provider,
            oauth_sub=sub,
            role="user",
            is_active=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        # 무료 플랜 생성
        free_sub = Subscription(
            user_id=db_user.id,
            plan_id=free_plan.id,  # ✅ 또는 plan=free_plan (둘 중 하나)
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365 * 100),
            is_active=True,
            created_at=datetime.now(UTC)
        )
        db.add(free_sub)
        db.commit()
        return db_user

    # 3) 기존 유저 있으면 로그인 처리 (updated_at 갱신)
    db_user.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(db_user)
    return db_user


def generate_login_response(db_user: User):
    """
    공통: 로그인 성공 후 응답(JSON)
    """
    token = create_access_token({"sub": str(db_user.id), "email": db_user.email})

    return JSONResponse({
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "name": db_user.name,
            "nickname": db_user.nickname,
            "picture": db_user.picture,
        }
    })