# backend/app/deps/auth.py

from typing import Optional
from fastapi import Depends, HTTPException, status, Cookie
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.model import User
from backend.app.util.auth import verify_token

# 🔥 여기 핵심: auto_error=False
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def _decode_user(token: str | None, db: Session) -> Optional[User]:
    """토큰을 검증해서 User를 돌려주고, 실패하면 None."""
    if not token:
        return None

    payload = verify_token(token, token_type="access")
    if payload is None:
        return None

    user_id = payload.get("sub")
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return None

    user = db.query(User).filter(User.id == user_id).first()
    return user


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    cookie_token: str | None = Cookie(default=None, alias="access_token"),
) -> User:
    token_to_use = token or cookie_token
    user = _decode_user(token_to_use, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    cookie_token: str | None = Cookie(default=None, alias="access_token"),
) -> Optional[User]:
    """
    토큰이 없거나, 검증 실패하면 그냥 None 리턴.
    여기서는 절대 401 던지지 않음.
    """
    token_to_use = token or cookie_token
    user = _decode_user(token_to_use, db)
    return user
