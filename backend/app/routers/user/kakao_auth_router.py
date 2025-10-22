# backend/app/routers/kakao_auth_router.py
from fastapi import APIRouter, Request, Depends, status
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
from fastapi.responses import RedirectResponse, JSONResponse
from datetime import datetime, UTC
from urllib.parse import quote
import os

from backend.app.db import get_db
from backend.app.model import User
from backend.app.deps.auth import get_current_user
from backend.app.crud.auth_crud import get_or_create_user
from backend.app.util.auth import create_access_token, create_refresh_token
from backend.app.util.errors import OAuthProviderConflict

router = APIRouter(prefix="/auth/kakao", tags=["KakaoAuth"])

# ✅ 환경변수에서 프론트 주소 가져오기 (기본값: 5173 포트)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
KAKAO_CLIENT_ID = os.getenv("KAKAO_CLIENT_ID")
KAKAO_LOGOUT_REDIRECT = f"{FRONTEND_URL}/login"
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)
ACCESS_TOKEN_MAX_AGE = 3600  # 초
SECURE_COOKIE = os.getenv("SECURE_COOKIE", "false").lower() == "true"
REFRESH_MAX_AGE = 60 * 60 * 24 * 14  # 14일

# ✅ Kakao OAuth 설정
oauth = OAuth()
oauth.register(
    name="kakao",
    client_id=KAKAO_CLIENT_ID,
    access_token_url="https://kauth.kakao.com/oauth/token",
    authorize_url="https://kauth.kakao.com/oauth/authorize",
    api_base_url="https://kapi.kakao.com/v2/",
    client_kwargs={"scope": "profile_nickname account_email profile_image"},
)


# ✅ 로그인 시작
@router.get("/login")
async def login_kakao(request: Request):
    redirect_uri = request.url_for("kakao_callback")
    return await oauth.kakao.authorize_redirect(request, redirect_uri)


# ✅ 콜백 (Kakao → 백엔드)
@router.get("/callback", name="kakao_callback")
async def kakao_callback(request: Request, db: Session = Depends(get_db)):
    # 1) 토큰/유저 정보
    token = await oauth.kakao.authorize_access_token(request)
    resp = await oauth.kakao.get("user/me", token=token)
    user_info = resp.json() or {}

    kakao_id = str(user_info.get("id") or "")
    kakao_account = user_info.get("kakao_account", {}) or {}
    profile = kakao_account.get("profile", {}) or {}

    provider = "kakao"
    email = kakao_account.get("email")  # 카카오는 동의 범위에 따라 없을 수 있음
    name = profile.get("nickname") or ""
    nickname = profile.get("nickname") or name
    picture = profile.get("profile_image_url") or ""

    # 2) 이메일 누락 시: 에러로 리다이렉트 (혹은 서비스 정책에 맞춰 가짜 이메일 생성)
    if not kakao_id:
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=kakao_login_failed",
            status_code=302,
        )
    if not email:
        # 프론트에서 '이메일 제공 동의 필요' 라우팅
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=missing_email&provider={provider}",
            status_code=302,
        )

    # 3) DB 처리 + provider 충돌 대응
    try:
        db_user = get_or_create_user(
            db=db,
            provider=provider,
            sub=kakao_id,
            email=email,
            name=name,
            nickname=nickname,
            picture=picture,
        )
    except OAuthProviderConflict as e:
        registered = getattr(e, "detail", {}).get("registered_provider", "")
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback"
            f"?error=provider_conflict&registered_provider={registered}"
            f"&email={quote(email)}&try_provider={provider}",
            status_code=302,
        )
    except Exception:
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=internal_error",
            status_code=302,
        )

    # 4) 탈퇴 계정
    if db_user and not db_user.is_active:
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=deactivated&email={quote(email)}",
            status_code=302,
        )

    # 5) 성공 → 토큰 발급 후 리다이렉트
    access_token = create_access_token({"sub": str(db_user.id), "email": db_user.email})
    refresh_token = create_refresh_token({"sub": str(db_user.id), "email": db_user.email})

    redirect_to = f"{FRONTEND_URL}/auth/callback?access_token={quote(access_token)}"
    resp = RedirectResponse(url=redirect_to, status_code=status.HTTP_302_FOUND)
    resp.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=SECURE_COOKIE,
        samesite="lax",
        max_age=REFRESH_MAX_AGE,
        domain=COOKIE_DOMAIN,
        path="/",
    )
    return RedirectResponse(redirect_to, status_code=302)


# ✅ 재가입 처리 (비활성 유저 복구)
@router.post("/rejoin")
def kakao_rejoin(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    if not current_user:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": "해당 사용자를 찾을 수 없습니다."}
        )

    if current_user.is_active:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "이미 활성화된 계정입니다."}
        )

    # ✅ 계정 재활성화
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
        },
    })


# ✅ 로그아웃 (Kakao 공식 로그아웃 + 프론트 리다이렉트)
@router.get("/logout")
async def kakao_logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("refresh_token", domain=COOKIE_DOMAIN, path="/")
    resp.delete_cookie("access_token", domain=COOKIE_DOMAIN, path="/")
    url = (
        f"https://kauth.kakao.com/oauth/logout"
        f"?client_id={KAKAO_CLIENT_ID}"
        f"&logout_redirect_uri={KAKAO_LOGOUT_REDIRECT}"
    )
    return RedirectResponse(url)
