from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
import os

from app.crud.auth_crud import get_or_create_user, generate_login_response
from app.db import get_db

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

    return generate_login_response(db_user)
