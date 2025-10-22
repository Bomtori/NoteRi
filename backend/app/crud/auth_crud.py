from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, UTC, date, timedelta
from fastapi.responses import JSONResponse
from fastapi import status

from backend.app.model import User, Subscription, Plan, PlanType  # PlanType 꼭 import
from backend.app.util.errors import OAuthProviderConflict
from backend.app.util.auth import create_access_token, create_refresh_token

def get_or_create_user(
    db: Session,
    provider: str,
    sub: str,
    email: str,
    name: str,
    nickname: str,
    picture: str,
) -> User:
    # 1) provider + sub로 조회 (이미 그 provider로 로그인한 적 있음)
    user = (
        db.query(User)
        .filter(User.oauth_provider == provider, User.oauth_sub == sub)
        .first()
    )
    if user:
        # 프로필 보강(비어있을 때만)
        user.name = user.name or name
        user.nickname = user.nickname or nickname
        user.picture = user.picture or picture
        user.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(user)
        return user

    # 2) 이메일로 조회 (이미 같은 이메일로 다른 provider 가입 여부 확인)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        # 기존 계정이 소셜 연동된 상태이고, 그 provider가 현재 시도한 provider와 다르면 충돌 처리
        if existing.oauth_provider and existing.oauth_provider != provider:
            # 예: 기존 'google', 시도는 'naver' → 병합 금지, 안내
            raise OAuthProviderConflict(registered_provider=existing.oauth_provider)

        # 여기서부터는 다음 케이스:
        # - 기존 계정이 있는데 아직 oauth_provider가 비어있음 → 이번 provider로 연결 허용
        # - 혹은 기존 provider와 같음(드문 케이스지만) → sub만 업데이트
        existing.oauth_provider = provider
        existing.oauth_sub = sub
        existing.name = existing.name or name
        existing.nickname = existing.nickname or nickname
        existing.picture = existing.picture or picture
        existing.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(existing)
        return existing

    # 3) 신규 생성 + 무료 구독 부여
    try:
        user = User(
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
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        # 경합이나 다른 곳에서 선점된 경우 이메일 재조회
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            raise
        if existing.oauth_provider and existing.oauth_provider != provider:
            # 이미 다른 provider로 가입돼 있었음 → 충돌
            raise OAuthProviderConflict(registered_provider=existing.oauth_provider)

        # 비어있거나 같은 provider면 연결
        existing.oauth_provider = provider
        existing.oauth_sub = sub
        existing.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(existing)
        return existing

    # ---- 여기까지 오면 완전 신규 유저 → 무료 플랜/구독 처리 ----
    # (1) 무료 Plan 조회 또는 생성
    free_plan = db.query(Plan).filter(Plan.name == PlanType.free).first()
    if not free_plan:
        free_plan = Plan(name=PlanType.free, price=0)
        db.add(free_plan)
        db.commit()
        db.refresh(free_plan)

    # (2) 활성 구독 없으면 무료 구독 부여
    has_active = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id, Subscription.is_active == True)
        .first()
    )
    if not has_active:
        free_sub = Subscription(
            user_id=user.id,
            plan_id=free_plan.id,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365 * 100),
            is_active=True,
            created_at=datetime.now(UTC),
        )
        db.add(free_sub)
        db.commit()
        db.refresh(free_sub)

    return user


def generate_login_response(db_user: User):
    access_token = create_access_token({"sub": str(db_user.id), "email": db_user.email})
    refresh_token = create_refresh_token({"sub": str(db_user.id), "email": db_user.email})

    response = JSONResponse({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "name": db_user.name,
            "nickname": db_user.nickname,
            "picture": db_user.picture,
        },
    })

    # 쿠키에 저장 (옵션)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # HTTPS일 때 True로
        samesite="lax",
        max_age=60 * 60 * 24 * 14,
    )
    return response