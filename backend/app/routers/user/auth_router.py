# backend/app/routers/auth_router.py
from fastapi import APIRouter, Depends, HTTPException, Cookie, Header, Body, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from backend.app.db import get_db
from backend.app.model import User
from backend.app.util.auth import verify_token, create_access_token
from fastapi.responses import RedirectResponse, JSONResponse
import os

router = APIRouter(prefix="/auth", tags=["Auth"])

COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)
KAKAO_CLIENT_ID = os.getenv("KAKAO_CLIENT_ID")
KAKAO_LOGOUT_REDIRECT = os.getenv("http://localhost:5173/logout")  # ex)
FRONTEND_LOGOUT_REDIRECT = os.getenv("FRONTEND_LOGOUT_REDIRECT", "http://localhost:5173/logout")

@router.post("/refresh")
def refresh_access_token(
    db: Session = Depends(get_db),
    cookie_rt: Optional[str] = Cookie(default=None, alias="refresh_token"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    body: dict | None = Body(default=None),
):
    # 1) 쿠키 우선
    rt = cookie_rt

    # 2) Authorization: Bearer <token> 허용
    if not rt and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            rt = parts[1]

    # 3) JSON 바디 { "refresh_token": "..." } 도 허용
    if not rt and body and isinstance(body, dict):
        rt = body.get("refresh_token")

    if not rt:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    payload = verify_token(rt, token_type="refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_access = create_access_token({"sub": str(user.id), "email": user.email})
    return {"access_token": new_access, "token_type": "bearer"}

@router.get("/logout")
async def logout(provider: str | None = Query(default=None, description="google, kakao, naver 중 하나")):
    """
    ✅ 통합 로그아웃 엔드포인트
    - provider query로 구분 (예: /auth/logout?provider=kakao)
    - 쿠키는 공통으로 삭제
    - provider 지정 없으면 프론트 로그아웃 리다이렉트로 이동
    """
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("refresh_token", domain=COOKIE_DOMAIN, path="/")
    resp.delete_cookie("access_token", domain=COOKIE_DOMAIN, path="/")

    # ✅ Provider별 외부 로그아웃 처리
    if provider == "kakao":
        url = (
            f"https://kauth.kakao.com/oauth/logout"
            f"?client_id={KAKAO_CLIENT_ID}"
            f"&logout_redirect_uri={KAKAO_LOGOUT_REDIRECT}"
        )
        return RedirectResponse(url)
    elif provider == "google":
        return RedirectResponse("https://accounts.google.com/Logout")
    elif provider == "naver":
        # 네이버는 공식 로그아웃 URL이 없지만,
        # 프론트 로그아웃 페이지로 리다이렉트
        return RedirectResponse(FRONTEND_LOGOUT_REDIRECT)
    else:
        # provider 없거나 잘못된 값 → 기본 프론트 로그아웃
        return RedirectResponse(FRONTEND_LOGOUT_REDIRECT)