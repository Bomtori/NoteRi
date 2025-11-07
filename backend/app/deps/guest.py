# backend/app/deps/guest.py
import os
import time
import jwt
import logging
from fastapi import Depends, Header, Cookie, Request
from typing import Optional
from backend.app.deps.auth import get_current_user  # 기존 재사용

logger = logging.getLogger("uvicorn")

# ✅ 올바른 키 구분
GUEST_SECRET_KEY = os.getenv("GUEST_SECRET_KEY")   # 게스트 전용 시크릿키
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

    # 1️⃣ 우선 Authorization 헤더 확인
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
        logger.info(f"🎫 guest: 헤더로 토큰 전달됨")
    
    # 2️⃣ 아니면 쿠키에서 추출
    elif "guest_token" in request.cookies:
        token = request.cookies.get("guest_token")
        logger.info(f"🍪 guest: 쿠키로 토큰 전달됨")
    
    # 3️⃣ fastapi Cookie 파라미터로도 시도 (alias용)
    elif guest_token_cookie:
        token = guest_token_cookie
        logger.info(f"🍪 guest: Cookie() 파라미터로 토큰 전달됨")

    # 토큰이 없다면 로그 후 None 리턴
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