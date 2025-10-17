from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, UTC, date, timedelta
from fastapi.responses import JSONResponse
from fastapi import status

from backend.app.model import User, Subscription, Plan, PlanType  # PlanType 꼭 import
from backend.app.util.auth import create_access_token


def get_or_create_user(
    db: Session,
    provider: str,
    sub: str,
    email: str,
    name: str,
    nickname: str,
    picture: str,
) -> User:
    # 1) provider + sub로 조회
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

    # 2) 이메일로 병합
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.oauth_provider = provider
        user.oauth_sub = sub
        user.name = user.name or name
        user.nickname = user.nickname or nickname
        user.picture = user.picture or picture
        user.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(user)
        return user

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
        # 경합 시 이메일 기준으로 재조회 후 provider/sub 업데이트
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise
        user.oauth_provider = provider
        user.oauth_sub = sub
        user.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(user)
        return user

    # ---- 여기까지 오면 '신규' 유저. 무료 플랜/구독 처리 ----
    # (1) 무료 Plan 조회 또는 생성
    free_plan = db.query(Plan).filter(Plan.name == PlanType.free).first()
    if not free_plan:
        free_plan = Plan(name=PlanType.free, price=0)  # 모델 스키마에 맞게 추가 필드 있으면 채우기
        db.add(free_plan)
        db.commit()
        db.refresh(free_plan)

    # (2) 사용자 활성 구독이 없을 때만 무료 구독 부여
    has_active = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id, Subscription.is_active == True)
        .first()
    )
    if not has_active:
        free_sub = Subscription(
            user_id=user.id,
            plan_id=free_plan.id,  # 관계 필드에 Enum 넣지 말고 plan_id 사용!
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365 * 100),
            is_active=True,
            created_at=datetime.now(UTC)
        )
        db.add(free_sub)
        db.commit()
        db.refresh(free_sub)

    return user


def generate_login_response(db_user: User):
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
