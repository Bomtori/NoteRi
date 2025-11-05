from fastapi import APIRouter, Request, Depends, status, Cookie, HTTPException
from urllib.parse import quote
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
import os
import traceback
from fastapi.responses import RedirectResponse
from datetime import datetime, UTC
from starlette.responses import JSONResponse
from backend.app.deps.auth import get_current_user
from backend.app.crud.auth_crud import get_or_create_user, generate_login_response, assert_login_allowed
from backend.app.util.auth import create_access_token, create_refresh_token, verify_token
from backend.app.db import get_db
from backend.app.model import User
from backend.app.util.errors import OAuthProviderConflict

router = APIRouter(prefix="/auth/google", tags=["GoogleAuth"])

oauth = OAuth()
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
    redirect_uri=os.getenv("GOOGLE_REDIRECT_URI")
)
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)
ACCESS_TOKEN_MAX_AGE = 3600  # 초
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SECURE_COOKIE = os.getenv("SECURE_COOKIE", "false").lower() == "true"
REFRESH_MAX_AGE = 60 * 60 * 24 * 14  # 14일

@router.get("/login", summary="구글 로그인")
async def login_google(request: Request):
    redirect_uri = request.url_for("google_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback", name="google_callback", summary="구글 콜백")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    # 0) 토큰/유저정보 수집
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")
    if not user_info:
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=google_login_failed",
            status_code=302,
        )

    provider = "google"
    sub = user_info.get("sub")
    email = user_info.get("email")
    name = user_info.get("name") or ""
    nickname = user_info.get("given_name") or ""
    picture = user_info.get("picture") or ""

    # 1) 이메일이 없는 계정(구글 조직 정책 등) 방어
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
        # 이미 다른 provider로 가입된 이메일 → 프론트에서 전용 안내
        # detail 안에 registered_provider를 넣어두었으니 꺼내서 전달
        registered = getattr(e, "detail", {}).get("registered_provider", "")
        # 프론트에서 이 정보를 이용해 "○○로 로그인" 버튼 제공
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback"
            f"?error=provider_conflict&registered_provider={registered}"
            f"&email={quote(email)}&try_provider={provider}",
            status_code=302,
        )
    except Exception as e:
        traceback.print_exc()
        print("🔥 GOOGLE OAUTH ERROR:", e)
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error=internal_error", status_code=302)

    # 3) 비활성(탈퇴) 계정 처리
    if db_user and not db_user.is_active:
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?error=deactivated&email={quote(email)}",
            status_code=302,
        )

    # 4) 성공 → 액세스 토큰을 쿼리파라미터로 전달
    access_token = create_access_token({"sub": str(db_user.id), "email": db_user.email})
    refresh_token = create_refresh_token({"sub": str(db_user.id), "email": db_user.email})

    redirect_to = f"{FRONTEND_URL}/auth/callback?access_token={quote(access_token)}"
    resp = RedirectResponse(url=redirect_to, status_code=status.HTTP_302_FOUND)
    resp.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # 로컬 HTTP는 False, 운영 HTTPS에서는 True
        samesite="lax",  # 서로 다른 '사이트'라면 None+Secure 필요
        domain=None,  # 로컬은 지정하지 않기 (Domain 속성 제거)
        max_age=REFRESH_MAX_AGE,
        path="/",
    )

    return resp

@router.post("/rejoin", summary="구글 재가입")
def google_rejoin(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
     # 토큰 인증된 유저
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

    # 토큰 발급
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
