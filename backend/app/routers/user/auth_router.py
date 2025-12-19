# backend/app/routers/auth_router.py
from fastapi import APIRouter, Depends, HTTPException, Cookie, Header, Body, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from backend.app.db import get_db
from backend.app.model import User
from backend.app.util.auth import verify_token, create_access_token
from fastapi.responses import RedirectResponse, JSONResponse
from urllib.parse import quote
from backend.app.crud.auth_crud import _cookie_options
import os

router = APIRouter(prefix="/auth", tags=["Auth"])

COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)
KAKAO_CLIENT_ID = os.getenv("KAKAO_CLIENT_ID")
KAKAO_LOGOUT_REDIRECT = os.getenv("KAKAO_LOGOUT_REDIRECT", "http://localhost:5173/logout")
FRONTEND_LOGOUT_REDIRECT = os.getenv("FRONTEND_LOGOUT_REDIRECT", "http://localhost:5173")
REFRESH_MAX_AGE = 60 * 60 * 24 * 14  # 14일

def _delete_cookie(resp: RedirectResponse, key: str):
    if COOKIE_DOMAIN:
        resp.delete_cookie(key, domain=COOKIE_DOMAIN, path="/")
    else:
        resp.delete_cookie(key, path="/")

@router.post("/refresh", summary="AccessToken 재발급")
def refresh_access_token(
    request: Request,
    db: Session = Depends(get_db),
    refresh_token_cookie: str | None = Cookie(default=None, alias="refresh_token"),
):
    # 🔍 디버그 로그: 실제로 쿠키가 들어오는지 확인
    print("🔎 /auth/refresh request.cookies:", request.cookies)
    print("🔎 /auth/refresh refresh_token_cookie is None?:", refresh_token_cookie is None)

    # 1) 쿠키 자체가 안 붙었을 때
    if not refresh_token_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    # 2) 리프레시 토큰 검증
    payload = verify_token(refresh_token_cookie, token_type="refresh")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # 3) 새 AccessToken 발급 (필요하면 role 등 추가)
    new_access = create_access_token(
        {"sub": str(user.id), "email": user.email, "role": user.role}
    )

    # 4) 응답 반환 (+ 필요하면 리프레시 토큰 회전)
    resp = JSONResponse(
        {
            "access_token": new_access,
            "token_type": "bearer",
        }
    )

    # 리프레시 토큰 회전(선택). 지금은 같은 값 다시 세팅.
    cookie_opts = _cookie_options()
    resp.set_cookie(
        key="refresh_token",
        value=refresh_token_cookie,
        httponly=True,
        max_age=REFRESH_MAX_AGE,
        path="/",
        **cookie_opts,
    )

    return resp

@router.get("/logout", summary="로그아웃")
def logout(provider: str | None = Query(default=None)):

    if provider == "google":
        target = "https://accounts.google.com/Logout"
    elif (provider == "naver" or "kakao"):
        target = FRONTEND_LOGOUT_REDIRECT
    else:
        target = FRONTEND_LOGOUT_REDIRECT

    resp = RedirectResponse(url=target, status_code=302)

    _delete_cookie(resp, "refresh_token")
    _delete_cookie(resp, "access_token")

    return resp