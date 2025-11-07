# backend/app/deps/guest.py
import os
import time
import jwt
import logging
from fastapi import Depends, Header, Cookie, Request
from typing import Optional
from backend.app.deps.auth import get_current_user 

logger = logging.getLogger("uvicorn")


GUEST_SECRET_KEY = os.getenv("GUEST_SECRET_KEY") 
JWT_ALG = "HS256"

def get_current_user_optional():
    try:
        return get_current_user()
    except Exception:
        return None

def get_principal(
    request: Request,
    authorization: str = Header(None),
    guest_token_cookie: str = Cookie(None, alias="guest_token"),
):
    token = None

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
        logger.info(f"🎫 guest: 헤더로 토큰 전달됨")

    elif "guest_token" in request.cookies:
        token = request.cookies.get("guest_token")
        logger.info(f"🍪 guest: 쿠키로 토큰 전달됨")

    elif guest_token_cookie:
        token = guest_token_cookie
        logger.info(f"🍪 guest: Cookie() 파라미터로 토큰 전달됨")

    if not token:
        logger.warning("🚫 guest 토큰 없음 (헤더/쿠키 모두 실패)")
        return None

    try:
        payload = jwt.decode(token, GUEST_SECRET_KEY, algorithms=[JWT_ALG])
        logger.info(f"✅ guest 토큰 해독 성공: {payload}")
        return payload
    except Exception as e:
        logger.warning(f"❌ guest 토큰 해독 실패: {e}")
        return None