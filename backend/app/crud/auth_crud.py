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
) -> User:
    # 1) 우선 provider+sub로 조회
    user = db.query(User).filter(
        User.oauth_provider == provider,
        User.oauth_sub == sub
    ).first()
    if user:
        # 프로필 최신화(선택)
        user.name = user.name or name
        user.nickname = user.nickname or nickname
        user.picture = user.picture or picture
        user.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(user)
        return user

    # 2) 없으면 email로 조회해서 같은 사람으로 본다 (이메일=계정 기준)
    user = db.query(User).filter(User.email == email).first()
    if user:
        # 기존 계정에 새로운 provider/sub 연결
        user.oauth_provider = provider
        user.oauth_sub = sub
        # 필요한 경우 프로필 갱신(비어있을 때만)
        user.name = user.name or name
        user.nickname = user.nickname or nickname
        user.picture = user.picture or picture
        user.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(user)
        return user

    # 3) email도 없으면 신규 생성
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
        return user
    except IntegrityError:
        # 경합 시 롤백 후 email 기준으로 재조회
        db.rollback()
        user = db.query(User).filter(User.email == email).first()
        if user:
            # 필요하면 provider/sub 업데이트
            user.oauth_provider = provider
            user.oauth_sub = sub
            user.updated_at = datetime.now(UTC)
            db.commit()
            db.refresh(user)
            return user
        raise


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