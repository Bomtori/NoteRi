# backend/app/deps/guest.py
import os

from fastapi import Depends, Header, Cookie
from typing import Optional
import jwt, time

JWT_SECRET = os.getenv("GUEST_SECRET_KEY")      # 환경변수로!
JWT_ALG = "HS256"
from backend.app.deps.auth import get_current_user  # 기존 것 재사용
def get_current_user_optional():
    try:
        return get_current_user()
    except Exception:
        return None

def get_principal(
    user = None,
    authorization: Optional[str] = Header(None),
    guest_token_cookie: Optional[str] = Cookie(default=None, alias="guest_token"),
):
    """
    반환:
      - 로그인 사용자면 {"type":"user","id":<int>}
      - 게스트면 {"type":"guest","board_id":<int>}
      - 아니면 None
    """
    # 1) 로그인 시 우선
    if user is None:
        user = get_current_user_optional()
    if user:
        return {"type": "user", "id": user.id}

    # 2) 게스트 토큰 (Authorization 또는 쿠키)
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
    elif guest_token_cookie:
        token = guest_token_cookie

    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
            if payload.get("guest") is True and int(payload.get("exp", 0)) > int(time.time()):
                return {"type": "guest", "board_id": int(payload.get("board_id", 0))}
        except Exception:
            pass

    return None