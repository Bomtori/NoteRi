# backend/app/routers/board_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from backend.app.deps.guest import get_principal
from backend.app.util.access import can_read_board
from backend.app.schemas import board_schema as schemas
from backend.app.db import get_db
from backend.app.crud import board_crud as crud
from backend.app.deps.auth import get_current_user
from backend.app.model import User, Board
from pydantic import BaseModel, StringConstraints
from typing import Annotated

router = APIRouter(prefix="/boards", tags=["boards"])

# Create (owner는 항상 JWT의 current_user.id)
@router.post("/", response_model=schemas.BoardResponse)
def create_board(
    board: schemas.BoardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return crud.create_board(db, current_user.id, board)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Read all
@router.get("/", response_model=list[schemas.BoardResponse])
def read_boards(skip: int = 0, limit: int = 10, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return crud.get_boards(db, current_user.id, skip=skip, limit=limit)

# Recent
@router.get("/recent", response_model=list[schemas.BoardResponse])
def read_board_recent(limit: int = 3, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return crud.get_recent_boards(db, current_user.id, limit=limit)

# Read one
@router.get("/{board_id}", response_model=schemas.BoardResponse)
def read_board(
    board_id: int,
    db: Session = Depends(get_db),
    principal = Depends(get_principal),  # ✅ 게스트/유저 공통 허용
):
    # 권한 체크
    if not can_read_board(db, board_id, principal):
        # 권한/존재 모호화 위해 404
        raise HTTPException(status_code=404, detail="Board not found or no permission")

    # 게스트도 통과했으므로 직접 보드 로드 후 반환
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board

# Update
@router.patch("/{board_id}", response_model=schemas.BoardResponse)
def update_board(board_id: int, board_update: schemas.BoardUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        board = crud.update_board(db, board_id, current_user, board_update)
        if not board:
            raise HTTPException(status_code=403, detail="No permission or board not found")
        return board
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error")

# Move (owner)
@router.patch("/{board_id}/move", response_model=schemas.BoardResponse)
def move_board_endpoint(board_id: int, board_move: schemas.BoardMove, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    board = crud.move_board(db, board_id, current_user, board_move)
    if not board:
        raise HTTPException(status_code=403, detail="No permission or board not found")
    return board

# Delete (owner)
@router.delete("/{board_id}", response_model=schemas.BoardResponse)
def delete_board(board_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    board = crud.delete_board(db, current_user, board_id)
    if not board:
        raise HTTPException(status_code=403, detail="No permission or board not found")
    return board

# Verify PIN (guest)
Pin = Annotated[str, StringConstraints(pattern=r"^\d{4}$")]
class BoardPasswordVerify(BaseModel):
    password: Pin

@router.post("/{board_id}/verify-password")
def verify_board_password(board_id: int, body: BoardPasswordVerify, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ok = crud.verify_board_password(db, board_id, body.password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
    return {"ok": True}
