from fastapi import APIRouter, Depends, Request, Header, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, UTC
import os
import traceback
from authlib.integrations.starlette_client import OAuth
from dotenv import load_dotenv

from app.db import SessionLocal
from app.model import User
from app.auth import create_access_token, verify_token
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

@router.get("/login/google")
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
            "role": db_user.role
        }
    })

@router.get("/me")
async def get_current_user(authorization: str = Header(...)):
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"user": payload}
