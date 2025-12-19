# backend/app/routers/board_password_router.py
import os

from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel, constr
from sqlalchemy.orm import Session
import jwt, time, json
from backend.app.db import get_db
from backend.app.deps.auth import get_current_user, get_current_user_optional
from backend.app.model import User, Board, BoardShare
from backend.app.schemas import board_schema as schemas
from backend.app.crud import board_password_crud as pw_crud

router = APIRouter(prefix="/boards", tags=["boards:password"])

# 요청 스키마: 숫자 4자리만 허용
class BoardPasswordSet(BaseModel):
    password: constr(pattern=r"^\d{4}$")

class BoardPasswordVerify(BaseModel):
    password: constr(pattern=r"^\d{4}$")

JWT_SECRET = os.getenv("GUEST_SECRET_KEY") 
JWT_ALG = "HS256"

# 비밀번호 설정/변경 (오너만)
@router.patch("/{board_id}/password", response_model=schemas.BoardResponse, summary="비밀번호 변경/설정")
def set_password(
    board_id: int,
    body: BoardPasswordSet,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        board = pw_crud.set_board_password(db, board_id, current_user.id, body.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


# 비밀번호 제거 (오너만)
@router.delete("/{board_id}/password", response_model=schemas.BoardResponse, summary="비밀번호 제거")
def clear_password(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = pw_crud.clear_board_password(db, board_id, current_user.id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


# 비밀번호 검증 (게스트/사용자 공통; 비로그인 허용)
@router.post("/{board_id}/verify-password", summary="보드 비밀번호 검증 및 guest 토큰 발급")
def verify_password(
    board_id: int,
    body: BoardPasswordVerify,
    response: Response,
    db: Session = Depends(get_db),
):
    # 🔑 평문 4자리 핀을 검증
    if not pw_crud.verify_board_password(db, board_id, body.password):
        raise HTTPException(status_code=403, detail="비밀번호 불일치")

    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail="GUEST_SECRET_KEY is not configured")

    payload = {
        "guest": True,
        "board_id": board_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + 60 * 60 * 6,  # 6시간
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

    response.set_cookie(
    key="guest_token",
    value=token,
    httponly=True,
    max_age=60 * 60 * 6,
    secure=True,       # ngrok https니까 True
    samesite="none",   # ✅ cross-site XHR 허용
    path="/",
)
    return {"message": "인증 성공", "guest_token": token}