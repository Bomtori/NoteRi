from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
import os

from app.db import SessionLocal
from app.user.common import get_or_create_user, generate_login_response

router = APIRouter(prefix="/auth/google", tags=["GoogleAuth"])

oauth = OAuth()
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/login")
async def login_google(request: Request):
    redirect_uri = request.url_for("google_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback", name="google_callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")
    if not user_info:
        return {"error": "Google login failed"}

    db_user = get_or_create_user(
        db=db,
        provider="google",
        sub=user_info["sub"],
        email=user_info.get("email"),
        name=user_info.get("name"),
        nickname=user_info.get("given_name"),
        picture=user_info.get("picture"),

    )

    return generate_login_response(db_user)
