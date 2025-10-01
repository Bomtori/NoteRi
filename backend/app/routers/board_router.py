from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from app.schemas import board_schema as schemas
from app.db import get_db
from app.crud import board_crud as crud
from app.deps.auth import get_current_user
from app.model import User

router = APIRouter(prefix="/boards", tags=["boards"])


# ✅ Create
@router.post("/", response_model=schemas.BoardResponse)
def create_board(
    board: schemas.BoardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return crud.create_board(db, current_user.id, board)


# ✅ Read all (내 보드 목록)
@router.get("/", response_model=list[schemas.BoardResponse])
def read_boards(
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return crud.get_boards(db, current_user.id, skip=skip, limit=limit)


# ✅ Read one (특정 보드)
@router.get("/{board_id}", response_model=schemas.BoardResponse)
def read_board(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    board = crud.get_board(db, current_user.id, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


# ✅ 최근 보드 목록
@router.get("/recent", response_model=list[schemas.BoardResponse])
def read_board_recent(
    limit: int = 3,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return crud.get_recent_boards(db, current_user.id, limit=limit)


# ✅ Update (PATCH)
@router.patch("/{board_id}", response_model=schemas.BoardResponse)
def update_board(
    board_id: int,
    board_update: schemas.BoardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        board = crud.update_board(db, board_id, current_user, board_update)

        if not board:
            raise HTTPException(status_code=404, detail="Board not found or not owned by user")

        return board

    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error")


# ✅ Delete
@router.delete("/{board_id}", response_model=schemas.BoardResponse)
def delete_board(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    board = crud.delete_board(db, current_user, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found or not owned by user")
    return board


# ✅ 폴더 이동 (PATCH)
@router.patch("/{board_id}/move", response_model=schemas.BoardResponse)
def move_board_endpoint(
    board_id: int,
    board_move: schemas.BoardMove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    board = crud.move_board(db, board_id, current_user, board_move)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found or not owned by user")
    return board
