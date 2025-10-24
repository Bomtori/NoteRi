# backend/app/routers/board_password_router.py
import os

from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel, constr
from sqlalchemy.orm import Session
import jwt, time, json
from backend.app.db import get_db
from backend.app.deps.auth import get_current_user, get_current_user_optional
from backend.app.model import User
from backend.app.schemas import board_schema as schemas
from backend.app.crud import board_password_crud as pw_crud

router = APIRouter(prefix="/boards", tags=["boards:password"])

# 요청 스키마: 숫자 4자리만 허용
class BoardPasswordSet(BaseModel):
    password: constr(pattern=r"^\d{4}$")  # exactly 4 digits

class BoardPasswordVerify(BaseModel):
    password: constr(pattern=r"^\d{4}$")

JWT_SECRET = os.getenv("GUEST_SECRET_KEY")      # 환경변수로!
JWT_ALG = "HS256"

# ✅ 비밀번호 설정/변경 (오너만)
@router.patch("/{board_id}/password", response_model=schemas.BoardResponse)
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
        # 존재/권한 노출 최소화: 404로 통일
        raise HTTPException(status_code=404, detail="Board not found")
    return board


# ✅ 비밀번호 제거 (오너만)
@router.delete("/{board_id}/password", response_model=schemas.BoardResponse)
def clear_password(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = pw_crud.clear_board_password(db, board_id, current_user.id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


# ✅ 비밀번호 검증 (게스트/사용자 공통; 비로그인 허용)
@router.post("/{board_id}/verify-password")
def verify_password(
    board_id: int,
    body: BoardPasswordVerify,
    db: Session = Depends(get_db),
):
    ok = pw_crud.verify_board_password(db, board_id, body.password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

    # ✅ 게스트 토큰 발급 (30분 유효)
    exp = int(time.time()) + 30 * 60
    payload = {
        "sub": "guest",
        "guest": True,
        "board_id": board_id,
        "exp": exp,
        "scope": "board:read"
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

    resp_data = {"ok": True, "exp": exp}
    response = Response(content=json.dumps(resp_data), media_type="application/json")

    # ✅ HttpOnly 쿠키로 세팅 (프론트엔드에서 자동 저장됨)
    response.set_cookie(
        key="guest_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # 운영 환경에서는 True로
        max_age=30 * 60,
        path="/",
    )

    return response