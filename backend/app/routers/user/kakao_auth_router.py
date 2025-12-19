# backend/app/routers/kakao_auth_router.py
from fastapi import APIRouter, Request, Depends, status, Cookie, HTTPException
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
from fastapi.responses import RedirectResponse, JSONResponse
from datetime import datetime, UTC
from urllib.parse import quote
import os
import traceback

from backend.app.db import get_db
from backend.app.model import User
from backend.app.deps.auth import get_current_user
from backend.app.crud.auth_crud import get_or_create_user, assert_login_allowed
from backend.app.util.auth import create_access_token, create_refresh_token, verify_token
from backend.app.util.errors import OAuthProviderConflict
from backend.app.crud.auth_crud import _cookie_options

router = APIRouter(prefix="/auth/kakao", tags=["KakaoAuth"])

# 환경변수에서 프론트 주소 가져오기 (기본값: 5173 포트)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
KAKAO_CLIENT_ID = os.getenv("KAKAO_CLIENT_ID")
KAKAO_LOGOUT_REDIRECT = f"{FRONTEND_URL}/login"
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)
ACCESS_TOKEN_MAX_AGE = 3600  # 초
SECURE_COOKIE = os.getenv("SECURE_COOKIE", "false").lower() == "true"
REFRESH_MAX_AGE = 60 * 60 * 24 * 14  # 14일

# Kakao OAuth 설정
oauth = OAuth()
oauth.register(
    name="kakao",
    client_id=KAKAO_CLIENT_ID,
    access_token_url="https://kauth.kakao.com/oauth/token",
    authorize_url="https://kauth.kakao.com/oauth/authorize",
    api_base_url="https://kapi.kakao.com/v2/",
    client_kwargs={"scope": "profile_nickname account_email profile_image"},
)

@router.get("/session-warmup", summary="OAuth 세션 웜업")
async def session_warmup(request: Request):
    _ = request.session
    return JSONResponse({"ok": True})

# 로그인 시작
@router.get("/login", summary="카카오 로그인")
async def login_kakao(request: Request):
    redirect_uri = request.url_for("kakao_callback")
    return await oauth.kakao.authorize_redirect(request, redirect_uri)


# 콜백 (Kakao → 백엔드)
@router.get("/callback", name="kakao_callback", summary="카카오 콜백")
async def kakao_callback(request: Request, db: Session = Depends(get_db)):
    # 0) 토큰/유저정보 수집
    token = await oauth.kakao.authorize_access_token(request)
    resp = await oauth.kakao.get("user/me", token=token)
    user_info = resp.json() or {}

    kakao_id = str(user_info.get("id") or "")
    kakao_account = user_info.get("kakao_account", {}) or {}
    profile = kakao_account.get("profile", {}) or {}

    provider = "kakao"
    sub = kakao_id
    email = kakao_account.get("email")  # 카카오는 동의 범위에 따라 없을 수 있음
    name = profile.get("nickname") or ""
    nickname = profile.get("nickname") or name
    picture = profile.get("profile_image_url") or ""

    # 1) 필수 정보 방어 (id / email)
    if not kakao_id:
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=kakao_login_failed",
            status_code=302,
        )
    if not email:
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=missing_email&provider={provider}",
            status_code=302,
        )

    # 2) 신규/기존 사용자 처리 + 충돌 처리
    try:
        db_user = get_or_create_user(
            db=db,
            provider=provider,
            sub=sub,
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
            f"&email={quote(email)}&try_provider={provider}",
            status_code=302,
        )
    except HTTPException as e:
        # 🔒 밴 계정 처리 (google_callback과 동일하게)
        if (
            e.status_code == 403
            and isinstance(e.detail, dict)
            and e.detail.get("error") == "banned_account"
        ):
            reason = quote(e.detail.get("reason", "관리자 조치"))
            until = quote(e.detail.get("until", "영구"))
            return RedirectResponse(
                f"{FRONTEND_URL}/auth/callback"
                f"?error=banned_account&reason={reason}&until={until}&email={quote(email or '')}",
                status_code=302,
            )
        # 기타 HTTPException은 내부 오류로 래핑
        traceback.print_exc()
        print("🔥 KAKAO OAUTH HTTP ERROR:", e)
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=internal_error",
            status_code=302,
        )
    except Exception as e:
        traceback.print_exc()
        print("🔥 KAKAO OAUTH ERROR:", e)
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=internal_error",
            status_code=302,
        )


    # 4) 성공 → 토큰 발급 후 리다이렉트
    access_token = create_access_token({"sub": str(db_user.id), "email": db_user.email})
    refresh_token = create_refresh_token({"sub": str(db_user.id), "email": db_user.email})

    redirect_to = f"{FRONTEND_URL}/auth/callback?access_token={quote(access_token)}"
    resp = RedirectResponse(url=redirect_to, status_code=status.HTTP_302_FOUND)

    # (선택) access_token 쿠키는 어차피 localStorage를 쓰니까 없어도 무방하지만, google과 동일하게 유지
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

    # ✅ 여기서 중요: refresh_token 쿠키 옵션 통일 (google_callback과 동일)
    cookie_opts = _cookie_options()  # FRONTEND_URL 기반으로 local/prod 구분

    resp.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=REFRESH_MAX_AGE,
        path="/",          # ✔ /auth/refresh 에도 항상 붙게
        **cookie_opts,     # ✔ localhost면 Lax/False, 배포면 None/True 등
    )

    return resp

# 재가입 처리 (비활성 유저 복구)
@router.post("/rejoin", summary="카카오 재가입")
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

    # 계정 재활성화
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