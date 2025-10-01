from sqlalchemy.orm import Session
from datetime import datetime, UTC, date, timedelta
from fastapi.responses import JSONResponse

from app.model import User, Subscription, PlanType
from app.util.auth import create_access_token


def get_or_create_user(db: Session, provider: str, sub: str, email: str, name: str, nickname: str, picture: str):
    """
    공통: OAuth 로그인한 유저 DB에 등록 (없으면 생성)
    """
    db_user = db.query(User).filter(
        User.oauth_provider == provider,
        User.oauth_sub == sub
    ).first()

    if not db_user:
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
            plan=PlanType.free,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365*100),
            is_active=True,
            payment_info={"type": "auto", "note": "free plan on signup"},
            created_at=datetime.now(UTC)
        )
        db.add(free_sub)
        db.commit()
    else:
        db_user.updated_at = datetime.now(UTC)
        db.commit()

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
