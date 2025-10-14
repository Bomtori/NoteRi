from fastapi import APIRouter, Request, Depends, status
from urllib.parse import quote
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
import os
from fastapi.responses import RedirectResponse
from datetime import datetime, UTC
from starlette.responses import JSONResponse
from backend.app.deps.auth import get_current_user
from backend.app.crud.auth_crud import get_or_create_user, generate_login_response
from backend.app.util.auth import create_access_token
from backend.app.db import get_db
from backend.app.model import User

router = APIRouter(prefix="/auth/google", tags=["GoogleAuth"])

oauth = OAuth()
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)
ACCESS_TOKEN_MAX_AGE = 3600  # 초
FRONTEND_URL = os.getenv("FRONTEND_URL")
@router.get("/login")
async def login_google(request: Request):
    redirect_uri = request.url_for("google_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback", name="google_callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")
    if not user_info:
        return JSONResponse(status_code=400, content={"error": "Google login failed"})

    db_user = get_or_create_user(
        db=db,
        provider="google",
        sub=user_info["sub"],
        email=user_info.get("email"),
        name=user_info.get("name"),
        nickname=user_info.get("given_name"),
        picture=user_info.get("picture"),
    )

    if db_user and not db_user.is_active:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "이미 탈퇴된 계정입니다. 다시 가입하시겠습니까?"}
        )

    access_token = create_access_token({"sub": str(db_user.id), "email": db_user.email})

    # ✅ 쿼리파라미터로 토큰 전달
    redirect_to = f"{FRONTEND_URL}/auth/callback?access_token={quote(access_token)}"
    print("[GOOGLE_CALLBACK redirect_to]", redirect_to)   # <— 로그 확인용
    return RedirectResponse(redirect_to)  # 기본 307 OK

@router.post("/rejoin")
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

@router.get("/logout")
async def google_logout():
    return RedirectResponse("https://accounts.google.com/Logout")