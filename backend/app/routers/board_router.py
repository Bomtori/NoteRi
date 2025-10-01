from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from app.schemas import board_schema as schemas
from app.db import get_db
from app.crud import board_crud as crud


router = APIRouter(prefix="/users/{user_id}/boards", tags=["boards"])

# ✅ Create
@router.post("/", response_model=schemas.BoardResponse)
def create_board(user_id: int, board: schemas.BoardCreate, db: Session = Depends(get_db)):
    return crud.create_board(db, user_id, board)


# ✅ Read all (특정 유저의 보드 목록)
@router.get("/", response_model=list[schemas.BoardResponse])
def read_boards(user_id: int, skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    boards = crud.get_boards(db, user_id, skip=skip, limit=limit)
    return boards


# ✅ Read one (특정 보드)
@router.get("/{board_id}", response_model=schemas.BoardResponse)
def read_board(user_id: int, board_id: int, db: Session = Depends(get_db)):
    board = crud.get_board(db, user_id, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board

# 최근 보드 목록
@router.get("/board/recent", response_model=list[schemas.BoardResponse])
def read_board_recent(user_id: int, limit: int = 3, db: Session = Depends(get_db)):
    boards = crud.get_recent_boards(db, user_id, limit=limit)
    return boards


# ✅ Update
@router.patch("/{board_id}", response_model=schemas.BoardResponse)
def update_board(board_id: int, board_update: schemas.BoardUpdate, db: Session = Depends(get_db)):
    try:
        board = crud.update_board(db, board_id, board_update)

        if not board:
            raise HTTPException(status_code=404, detail="Board not found or not owned by user")

        return board

    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error")


# ✅ Delete
@router.delete("/{board_id}", response_model=schemas.BoardResponse)
def delete_board(user_id: int, board_id: int, db: Session = Depends(get_db)):
    board = crud.delete_board(db, user_id, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found or not owned by user")
    return board

# 폴더 이동
@router.patch("/{board_id}/move", response_model=schemas.BoardResponse)
def move_board_endpoint(
    user_id: int,
    board_id: int,
    board_move: schemas.BoardMove,   # ✅ JSON Body로 받음
    db: Session = Depends(get_db)
):
    board = crud.move_board(db, user_id, board_id, board_move)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found or not owned by user")
    return board