# backend/app/routers/naver_auth_router.py
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

router = APIRouter(prefix="/auth/naver", tags=["NaverAuth"])

# 프론트 진입점 (Vite 5173, /test 프리픽스)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")

oauth = OAuth()
oauth.register(
    name="naver",
    client_id=NAVER_CLIENT_ID,
    client_secret=NAVER_CLIENT_SECRET,
    authorize_url="https://nid.naver.com/oauth2.0/authorize",
    access_token_url="https://nid.naver.com/oauth2.0/token",
    api_base_url="https://openapi.naver.com/v1/nid/",
    client_kwargs={"scope": "profile"},  # email 포함하려면 'profile'로 충분 (응답에서 제공)
)

@router.get("/login")
async def login_naver(request: Request):
    redirect_uri = request.url_for("naver_callback")
    return await oauth.naver.authorize_redirect(request, redirect_uri)

@router.get("/callback", name="naver_callback")
async def naver_callback(request: Request, db: Session = Depends(get_db)):
    # 1) 액세스 토큰 교환
    token = await oauth.naver.authorize_access_token(request)

    # 2) 사용자 정보 조회
    resp = await oauth.naver.get("me", token=token)
    payload = resp.json()
    user_info = (payload or {}).get("response")
    if not user_info:
        return JSONResponse(status_code=400, content={"error": "Naver login failed", "raw": payload})

    # 3) 필드 매핑
    naver_id = str(user_info.get("id"))
    email = user_info.get("email") or f"{naver_id}@naver.com"
    name = user_info.get("name") or user_info.get("nickname")
    nickname = user_info.get("nickname") or name
    picture = user_info.get("profile_image")

    # 4) 유저 생성/조회
    db_user = get_or_create_user(
        db=db,
        provider="naver",
        sub=naver_id,
        email=email,
        name=name,
        nickname=nickname,
        picture=picture,
    )

    if db_user and not db_user.is_active:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "이미 탈퇴된 계정입니다. 다시 가입하시겠습니까?"}
        )

    # 5) 우리 서비스용 access_token 발급 후 프론트로 리다이렉트(쿼리)
    access_token = create_access_token({"sub": str(db_user.id), "email": db_user.email})
    redirect_to = f"{FRONTEND_URL}/auth/callback?access_token={quote(access_token)}"
    print("[NAVER_CALLBACK redirect_to]", redirect_to)
    return RedirectResponse(redirect_to)

@router.post("/rejoin")
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
