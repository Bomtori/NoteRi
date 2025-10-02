from fastapi import APIRouter, Request, Depends, status
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
import os
from datetime import datetime, UTC
from starlette.responses import JSONResponse
from app.deps.auth import get_current_user
from app.crud.auth_crud import get_or_create_user, generate_login_response
from app.db import get_db
from app.util.auth import create_access_token
from app.model import User
router = APIRouter(prefix="/auth/naver", tags=["NaverAuth"])

oauth = OAuth()
oauth.register(
    name="naver",
    client_id=os.getenv("NAVER_CLIENT_ID"),
    client_secret=os.getenv("NAVER_CLIENT_SECRET"),
    authorize_url="https://nid.naver.com/oauth2.0/authorize",
    access_token_url="https://nid.naver.com/oauth2.0/token",
    api_base_url="https://openapi.naver.com/v1/nid/",
    client_kwargs={"scope": "profile"},
)

@router.get("/login")
async def login_naver(request: Request):
    redirect_uri = request.url_for("naver_callback")

    return await oauth.naver.authorize_redirect(request, redirect_uri)

@router.get("/callback", name="naver_callback")
async def naver_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.naver.authorize_access_token(request)
    print("DEBUG >>> token =", token)  # ✅ 토큰 확인
    resp = await oauth.naver.get("me", token=token)
    print("DEBUG >>> raw resp =", resp.json())  # ✅ 네이버 응답 확인

    user_info = resp.json().get("response")

    if not user_info:
        return {"error": "Naver login failed"}

    naver_id = str(user_info.get("id"))
    email = user_info.get("email")
    name = user_info.get("name")
    nickname = user_info.get("nickname")
    picture = user_info.get("profile_image")

    db_user = get_or_create_user(
        db=db,
        provider="naver",
        sub=naver_id,
        email=email or  f"{naver_id}@naver.com",
        name=name,
        nickname=nickname,
        picture=picture,
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
def naver_rejoin(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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

# naver logout 은 react에서 해야함!
# 다른 google과 kakao도 같은 과정 거쳐야함
#const handleLogout = () => {
#   localStorage.removeItem("access_token"); // 토큰 삭제
#   window.location.href = "/login"; // 로그인 페이지로 이동
# };