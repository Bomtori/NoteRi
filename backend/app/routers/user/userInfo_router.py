from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, UTC

from app.deps.auth import get_current_user
from app.model import User
from app.db import get_db
from app.schemas import user_schema
import os

router = APIRouter()

# 📌 Pydantic 모델 정의

# ✅ 사용자 정보 조회 (GET)
@router.get("/users/me", response_model=user_schema.UserResponse)
async def get_user_me(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "nickname": current_user.nickname,
        "picture": current_user.picture,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
    }


# ✅ 사용자 정보 수정 (PATCH)
@router.patch("/users/me")
async def update_user(
    data: user_schema.UserUpdate,
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
    for board in current_user.boards:
        db.delete(board)
    db.commit()



    return {"message": "User deactivated"}

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
