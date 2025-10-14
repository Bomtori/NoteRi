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
from backend.app.util.auth import create_access_token

router = APIRouter(prefix="/auth/kakao", tags=["KakaoAuth"])

# ✅ 환경변수에서 프론트 주소 가져오기 (기본값: 5173 포트)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
KAKAO_CLIENT_ID = os.getenv("KAKAO_CLIENT_ID")
KAKAO_LOGOUT_REDIRECT = f"{FRONTEND_URL}/login"

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
    token = await oauth.kakao.authorize_access_token(request)
    resp = await oauth.kakao.get("user/me", token=token)
    user_info = resp.json()

    kakao_id = str(user_info.get("id"))
    kakao_account = user_info.get("kakao_account", {})
    profile = kakao_account.get("profile", {})

    # ✅ DB 등록 or 조회
    db_user = get_or_create_user(
        db=db,
        provider="kakao",
        sub=kakao_id,
        email=kakao_account.get("email"),
        name=profile.get("nickname"),
        nickname=profile.get("nickname"),
        picture=profile.get("profile_image_url"),
    )

    # ✅ 비활성 유저 예외 처리
    if db_user and not db_user.is_active:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "이미 탈퇴된 계정입니다. 다시 가입하시겠습니까?"}
        )

    # ✅ 토큰 발급
    access_token = create_access_token({"sub": str(db_user.id), "email": db_user.email})

    # ✅ 프론트로 access_token 전달 (쿼리로)
    redirect_to = f"{FRONTEND_URL}/auth/callback?access_token={quote(access_token)}"
    print("[KAKAO_CALLBACK redirect_to]", redirect_to)
    return RedirectResponse(redirect_to)


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
    url = (
        f"https://kauth.kakao.com/oauth/logout"
        f"?client_id={KAKAO_CLIENT_ID}"
        f"&logout_redirect_uri={KAKAO_LOGOUT_REDIRECT}"
    )
    return RedirectResponse(url)
