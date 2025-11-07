# backend/app/routers/auth_router.py
from fastapi import APIRouter, Depends, HTTPException, Cookie, Header, Body, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from backend.app.db import get_db
from backend.app.model import User
from backend.app.util.auth import verify_token, create_access_token
from fastapi.responses import RedirectResponse, JSONResponse
from urllib.parse import quote
import os

router = APIRouter(prefix="/auth", tags=["Auth"])

COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)
KAKAO_CLIENT_ID = os.getenv("KAKAO_CLIENT_ID")
KAKAO_LOGOUT_REDIRECT = os.getenv("KAKAO_LOGOUT_REDIRECT", "http://localhost:5173/logout")
FRONTEND_LOGOUT_REDIRECT = os.getenv("FRONTEND_LOGOUT_REDIRECT", "http://localhost:5173")


def _delete_cookie(resp: RedirectResponse, key: str):
    if COOKIE_DOMAIN:
        resp.delete_cookie(key, domain=COOKIE_DOMAIN, path="/")
    else:
        resp.delete_cookie(key, path="/")

@router.post("/refresh", summary="refresh token 발급")
def refresh_access_token(
    db: Session = Depends(get_db),
    cookie_rt: Optional[str] = Cookie(default=None, alias="refresh_token"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    body: dict | None = Body(default=None),
):

    rt = cookie_rt

    if not rt and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            rt = parts[1]

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