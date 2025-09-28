from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.board import crud, schemas
from app.db import SessionLocal


router = APIRouter(prefix="/users/{user_id}/boards", tags=["boards"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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


# ✅ Update
@router.put("/{board_id}", response_model=schemas.BoardResponse)
def update_board(user_id: int, board_id: int, board_update: schemas.BoardUpdate, db: Session = Depends(get_db)):
    board = crud.update_board(db, user_id, board_id, board_update)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found or not owned by user")
    return board


# ✅ Delete
@router.delete("/{board_id}", response_model=schemas.BoardResponse)
def delete_board(user_id: int, board_id: int, db: Session = Depends(get_db)):
    board = crud.delete_board(db, user_id, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found or not owned by user")
    return board
