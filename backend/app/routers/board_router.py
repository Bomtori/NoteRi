from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.schemas import board_schema as schemas
from backend.app.db import get_db
from backend.app.crud import board_crud as crud
from backend.app.deps.auth import get_current_user
from backend.app.model import User

router = APIRouter(prefix="/boards", tags=["boards"])


# Create (owner는 항상 JWT의 current_user.id)
@router.post("/", response_model=schemas.BoardResponse)
def create_board(
    board: schemas.BoardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return crud.create_board(db, current_user.id, board)


# Read all (소유 + 공유받은 보드)
@router.get("/", response_model=list[schemas.BoardResponse])
def read_boards(
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return crud.get_boards(db, current_user.id, skip=skip, limit=limit)


# Recent (소유 + 공유받은 보드)
@router.get("/recent", response_model=list[schemas.BoardResponse])
def read_board_recent(
    limit: int = 3,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return crud.get_recent_boards(db, current_user.id, limit=limit)


# Read one (소유자 또는 공유자만)
@router.get("/{board_id}", response_model=schemas.BoardResponse)
def read_board(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = crud.get_board(db, current_user.id, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found or no permission")
    return board


# Update (owner 또는 editor 이상)
@router.patch("/{board_id}", response_model=schemas.BoardResponse)
def update_board(
    board_id: int,
    board_update: schemas.BoardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        board = crud.update_board(db, board_id, current_user, board_update)
        if not board:
            raise HTTPException(status_code=403, detail="No permission or board not found")
        return board
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error")


# Move (오너만)
@router.patch("/{board_id}/move", response_model=schemas.BoardResponse)
def move_board_endpoint(
    board_id: int,
    board_move: schemas.BoardMove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = crud.move_board(db, board_id, current_user, board_move)
    if not board:
        raise HTTPException(status_code=403, detail="No permission or board not found")
    return board


# Delete (오너만)
@router.delete("/{board_id}", response_model=schemas.BoardResponse)
def delete_board(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    board = crud.delete_board(db, current_user, board_id)
    if not board:
        raise HTTPException(status_code=403, detail="No permission or board not found")
    return board


# (선택) 비밀번호 검증 — 숫자 4자리만 허용
from pydantic import BaseModel, constr

class BoardPasswordVerify(BaseModel):
    password: constr(regex=r"^\d{4}$")  # exactly 4 digits

@router.post("/{board_id}/verify-password")
def verify_board_password(
    board_id: int,
    body: BoardPasswordVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # 필요 시 Optional 의존성으로 바꿔도 됨
):
    ok = crud.verify_board_password(db, board_id, body.password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
    return {"ok": True}
