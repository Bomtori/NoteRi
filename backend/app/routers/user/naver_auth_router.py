# backend/app/routers/naver_auth_router.py
import traceback
from fastapi import APIRouter, Request, Depends, status, Cookie, HTTPException
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
from fastapi.responses import RedirectResponse, JSONResponse
from datetime import datetime, UTC
from urllib.parse import quote
import os

from backend.app.db import get_db
from backend.app.model import User
from backend.app.deps.auth import get_current_user
from backend.app.crud.auth_crud import get_or_create_user, assert_login_allowed
from backend.app.util.auth import create_access_token, create_refresh_token, verify_token
from backend.app.util.errors import OAuthProviderConflict

router = APIRouter(prefix="/auth/naver", tags=["NaverAuth"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")
SECURE_COOKIE = os.getenv("SECURE_COOKIE", "false").lower() == "true"
REFRESH_MAX_AGE = 60 * 60 * 24 * 14  # 14일
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)
ACCESS_TOKEN_MAX_AGE = 3600  # 초

oauth = OAuth()
oauth.register(
    name="naver",
    client_id=NAVER_CLIENT_ID,
    client_secret=NAVER_CLIENT_SECRET,
    authorize_url="https://nid.naver.com/oauth2.0/authorize",
    access_token_url="https://nid.naver.com/oauth2.0/token",
    api_base_url="https://openapi.naver.com/v1/nid/",
    client_kwargs={"scope": "profile"},
)

@router.get("/login", summary="네이버 로그인")
async def login_naver(request: Request):
    redirect_uri = request.url_for("naver_callback")
    return await oauth.naver.authorize_redirect(request, redirect_uri)

@router.get("/callback", name="naver_callback", summary="네이버 콜백")
async def naver_callback(request: Request, db: Session = Depends(get_db)):
    # 1) 토큰 교환
    token = await oauth.naver.authorize_access_token(request)

    # 2) 사용자 정보
    resp = await oauth.naver.get("me", token=token)
    payload = resp.json() or {}
    user_info = payload.get("response")
    if not user_info:
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=naver_login_failed",
            status_code=302,
        )

    provider = "naver"
    naver_id = str(user_info.get("id") or "")
    email = user_info.get("email")
    if not email and naver_id:
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=missing_email&provider={provider}",
            status_code=302,
        )

    name = user_info.get("name") or user_info.get("nickname") or ""
    nickname = user_info.get("nickname") or name
    picture = user_info.get("profile_image") or ""

    # 3) DB 처리 + provider 충돌 대응
    try:
        db_user = get_or_create_user(
            db=db,
            provider=provider,
            sub=naver_id,
            email=email,
            name=name,
            nickname=nickname,
            picture=picture,
        )
        assert_login_allowed(db_user, db)
    except OAuthProviderConflict as e:
        registered = getattr(e, "detail", {}).get("registered_provider", "")
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback"
            f"?error=provider_conflict&registered_provider={registered}"
            f"&email={quote(email or '')}&try_provider={provider}",
            status_code=302,
        )
    except HTTPException as e:
        if e.status_code == 403 and isinstance(e.detail, dict) and e.detail.get("error") == "banned_account":
            reason = quote(e.detail.get("reason", "관리자 조치"))
            until = quote(e.detail.get("until", "영구"))
            return RedirectResponse(
                f"{FRONTEND_URL}/auth/callback?error=banned_account&reason={reason}&until={until}&email={quote(email or '')}",
                status_code=302,
            )
    except Exception as e:
        traceback.print_exc()
        print("NAVER OAUTH ERROR:", e)
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=internal_error", status_code=302)


    # 4) 탈퇴 계정
    if db_user and not db_user.is_active:
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=deactivated&email={quote(email)}",
            status_code=302,
        )

    # 5) 성공 → 토큰 발급 후 리다이렉트
    access_token = create_access_token({"sub": str(db_user.id), "email": db_user.email})
    refresh_token = create_refresh_token({"sub": str(db_user.id), "email": db_user.email})

    # access_token을 URL 쿼리에 포함하여 전달
    redirect_to = f"{FRONTEND_URL}/auth/callback?access_token={quote(access_token)}"
    resp = RedirectResponse(url=redirect_to, status_code=status.HTTP_302_FOUND)
    
    # access_token도 쿠키로 설정 (프론트엔드가 자동으로 사용 가능)
    resp.set_cookie(
        key="access_token",
        value=access_token,
        httponly=False,
        secure=False,    
        samesite="lax",
        domain=None,
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/",
    )
    
    # refresh_token 쿠키 설정
    resp.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True, 
        secure=False, 
        samesite="lax",
        domain=None,
        max_age=REFRESH_MAX_AGE,
        path="/",
    )

    return resp

@router.post("/rejoin", summary="네이버 재가입")
def naver_rejoin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user:
        return JSONResponse(status_code=404, content={"detail": "해당 사용자를 찾을 수 없습니다."})
    if current_user.is_active:
        return JSONResponse(status_code=400, content={"detail": "이미 활성화된 계정입니다."})

    current_user.is_active = True
    current_user.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(current_user)

    token = create_access_token({"sub": str(current_user.id), "email": current_user.email})
    return JSONResponse({
        "message": "계정이 재활성화되었습니다.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "nickname": current_user.nickname,
            "picture": current_user.picture,
        }
    })