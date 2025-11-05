# backend/app/deps/guest.py
import os
import time
import jwt
from fastapi import Depends, Header, Cookie
from typing import Optional
from backend.app.deps.auth import get_current_user  # 기존 재사용

# ✅ 올바른 키 구분
GUEST_SECRET_KEY = os.getenv("GUEST_SECRET_KEY")   # 게스트 전용 시크릿키
JWT_ALG = "HS256"

def get_current_user_optional():
    try:
        return get_current_user()
    except Exception:
        return None

def get_principal(
    user=Depends(get_current_user_optional),
    authorization: Optional[str] = Header(None),
    guest_token_cookie: Optional[str] = Cookie(default=None, alias="guest_token"),
):
    """
    반환:
      - 로그인 사용자면 {"type":"user","id":<int>}
      - 게스트면 {"type":"guest","board_id":<int>}
      - 아니면 None
    """
    print("🔑 Loaded guest key:", GUEST_SECRET_KEY[:10]) 
    # 1️⃣ 로그인 사용자 우선
    if user:
        print("✅ 로그인 유저 principal 반환:", user.id)
        return {"type": "user", "id": user.id}

    # 2️⃣ 게스트 토큰 (Authorization 또는 쿠키)
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
    elif guest_token_cookie:
        token = guest_token_cookie

    if token:
        try:
            # ✅ 게스트용 키로 검증해야 함
            payload = jwt.decode(token, GUEST_SECRET_KEY, algorithms=[JWT_ALG])
            if payload.get("guest") is True and int(payload.get("exp", 0)) > int(time.time()):
                print("✅ 게스트 principal 반환:", payload)
                return {"type": "guest", "board_id": int(payload.get("board_id", 0))}
        except Exception as e:
            print("⚠️ guest 토큰 디코드 실패:", e)

    print("🚫 principal is None (user와 guest 모두 감지 실패)")
    return None
