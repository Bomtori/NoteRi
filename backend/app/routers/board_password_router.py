# backend/app/routers/board_password_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, constr
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.deps.auth import get_current_user, get_current_user_optional
from backend.app.model import User
from backend.app.schemas import board_schema as schemas
from backend.app.crud import board_password_crud as pw_crud

router = APIRouter(prefix="/boards", tags=["boards:password"])

# 요청 스키마: 숫자 4자리만 허용
class BoardPasswordSet(BaseModel):
    password: constr(regex=r"^\d{4}$")  # exactly 4 digits

class BoardPasswordVerify(BaseModel):
    password: constr(regex=r"^\d{4}$")


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
    _maybe_user: User | None = Depends(get_current_user_optional),  # 로그인 여부 무관
):
    ok = pw_crud.verify_board_password(db, board_id, body.password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
    return {"ok": True}
