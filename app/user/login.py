from fastapi import APIRouter, Depends, Request, Header, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, UTC
import os
import traceback
from authlib.integrations.starlette_client import OAuth
from dotenv import load_dotenv
from datetime import date, timedelta

from app.db import SessionLocal
from app.model import User, Subscription, PlanType
from app.util.auth import create_access_token, verify_token
import logging
logging.basicConfig(level=logging.DEBUG)

router = APIRouter()
load_dotenv()

# DB 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# OAuth 등록
oauth = OAuth()
try:
    oauth.register(
        name="google",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )
    print("DEBUG >>> Google OAuth registered OK")
except Exception as e:
    print("ERROR in oauth.register:", e)
    traceback.print_exc()

@router.get("/login/google") # 로그인
async def login_google(request: Request):
    try:
        redirect_uri = request.url_for("auth_google_callback")
        print("DEBUG >>> redirect_uri =", redirect_uri)
        return await oauth.google.authorize_redirect(request, redirect_uri)
    except Exception as e:

        print("ERROR in login_google:", e)
        traceback.print_exc()
        return {"error": str(e)}

@router.get("/auth/google/callback")
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")
    if not user_info:
        return {"error": "No user info from Google"}

    google_id = user_info["sub"]

    db_user = db.query(User).filter(
        User.oauth_provider == "google",
        User.oauth_sub == google_id
    ).first()

    if not db_user:
        db_user = User(
            email=user_info["email"],
            name=user_info.get("name"),
            nickname=user_info.get("given_name"),  # ✅ 구글은 given_name, family_name 제공
            picture=user_info.get("picture"),  # ✅ 구글 프로필 사진 URL
            oauth_provider="google",
            oauth_sub=google_id,
            role="user",
            is_active=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        # ✅ 무료 구독 자동 생성
        free_sub = Subscription(
            user_id=db_user.id,
            plan=PlanType.free,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365 * 100),  # 사실상 무제한
            is_active=True,
            payment_info={"type": "auto", "note": "free plan on signup"},
            created_at=datetime.now(UTC)
        )
        db.add(free_sub)
        db.commit()
    else:
        db_user.updated_at = datetime.now(UTC)
        db.commit()

    # ✅ JWT 발급
    access_token = create_access_token({"sub": str(db_user.id), "email": db_user.email})

    return JSONResponse({
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "name": db_user.name,
            "role": db_user.role,
            "nickname" : db_user.nickname,
            "picture": db_user.picture,
        }
    })

@router.get("/me") # 유저 정보 가져오기
async def get_current_user(authorization: str = Header(...)):
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"user": payload}


@router.post("/logout") # 로그아웃
async def logout():
    # 실제로는 서버에서 할 일이 없음
    return {"message": "Successfully logged out. Please remove token on client side."}

# 클라이언트(React)에서 짤 코드
# // 로그아웃 버튼 클릭 시
# localStorage.removeItem("access_token");   // 토큰 삭제
# // 또는 sessionStorage.removeItem("access_token");
#
# // 로그인 페이지로 이동
# window.location.href = "/login";

# ✅ 구글 세션까지 끊는 로그아웃
@router.get("/logout/google")
async def google_logout():
    """
    구글 계정 로그아웃까지 실행.
    """
    return RedirectResponse(url="https://accounts.google.com/Logout")