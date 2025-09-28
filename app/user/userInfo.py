from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime, UTC
from pydantic import BaseModel

from app.db import SessionLocal
from app.model import User
from app.auth import verify_token

import os, uuid

router = APIRouter()

# DB 세션 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# JWT에서 현재 사용자 가져오기
def get_current_user(authorization: str = Header(...), db: Session = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found or inactive")
    return user

# 📌 Pydantic 모델 정의
class UserUpdate(BaseModel):
    name: str | None = None
    nickname: str | None = None
    picture: str | None = None   # URL 문자열 저장

# ✅ 사용자 정보 수정 (PATCH)
@router.patch("/users/me")
async def update_user(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if data.name is not None:
        current_user.name = data.name
    if data.nickname is not None:
        current_user.nickname = data.nickname
    if data.picture is not None:
        current_user.picture = data.picture

    current_user.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(current_user)
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "nickname": current_user.nickname,
        "picture": current_user.picture
    }

# ✅ 사용자 탈퇴 (soft delete)
@router.delete("/users/me")
async def delete_user(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.is_active = False
    current_user.updated_at = datetime.now(UTC)
    db.commit()
    return {"message": "User deactivated"}

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)