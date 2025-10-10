from fastapi import APIRouter, Request, Depends, status
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
import os
from backend.app.deps.auth import get_current_user
from datetime import datetime, UTC
from starlette.responses import JSONResponse
from fastapi.responses import RedirectResponse
from backend.app.model import User
from backend.app.crud.auth_crud import get_or_create_user, generate_login_response
from backend.app.util.auth import create_access_token
from backend.app.db import get_db

router = APIRouter(prefix="/auth/kakao", tags=["KakaoAuth"])

oauth = OAuth()
oauth.register(
    name="kakao",
    client_id=os.getenv("KAKAO_CLIENT_ID"),
    # client_secret=os.getenv("KAKAO_CLIENT_SECRET"),
    access_token_url="https://kauth.kakao.com/oauth/token",
    authorize_url="https://kauth.kakao.com/oauth/authorize",
    api_base_url="https://kapi.kakao.com/v2/",
    client_kwargs={"scope": "profile_nickname account_email profile_image"},
)

@router.get("/login")
async def login_kakao(request: Request):
    redirect_uri = request.url_for("kakao_callback")
    return await oauth.kakao.authorize_redirect(request, redirect_uri)


@router.get("/callback", name="kakao_callback")
async def kakao_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.kakao.authorize_access_token(request)
    resp = await oauth.kakao.get("user/me", token=token)
    user_info = resp.json()

    kakao_id = str(user_info.get("id"))
    kakao_account = user_info.get("kakao_account", {})
    profile = kakao_account.get("profile", {})

    db_user = get_or_create_user(
        db=db,
        provider="kakao",
        sub=kakao_id,
        email=kakao_account.get("email"),
        name=profile.get("nickname"),
        nickname=profile.get("nickname"),
        picture=profile.get("profile_image_url"),
    )
    if db_user and not db_user.is_active:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "detail": "이미 탈퇴된 계정입니다. 다시 가입하시겠습니까?"
            }
        )

    return generate_login_response(db_user)


@router.post("/rejoin")
def kakao_rejoin(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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

@router.get("/logout")
async def kakao_logout():
    return RedirectResponse("https://kauth.kakao.com/oauth/logout?client_id=YOUR_KAKAO_REST_API_KEY&logout_redirect_uri=http://localhost:3000/login")