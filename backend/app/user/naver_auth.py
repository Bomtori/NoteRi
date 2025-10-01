from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
import os

from app.db import SessionLocal
from app.user.common import get_or_create_user, generate_login_response

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

    return generate_login_response(db_user)
