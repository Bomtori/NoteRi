from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from backend.app.db import get_db
from backend.app.schemas import memo_schema as schemas
from backend.app.crud import memo_crud as crud, memo_crud
from backend.app.deps.auth import get_current_user
from backend.app.model import User

router = APIRouter(prefix="/boards/{board_id}/memos", tags=["memos"])


# Read all
@router.get("/", response_model=list[schemas.MemoResponse], summary="메모 가져오기")
def read_board_memo(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memo = memo_crud.get_memo_by_board(db, board_id)
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    return memo


# Read one
@router.get("/{memo_id}", response_model=schemas.MemoResponse, summary="특정 메모 읽기")
def read_memo(board_id: int, memo_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    memo = crud.get_memo(db, memo_id)
    if not memo or memo.board_id != board_id:
        raise HTTPException(status_code=404, detail="Memo not found")
    return memo


# Update
@router.patch("/{memo_id}", response_model=schemas.MemoResponse, summary="메모 업데이트")
def update_memo(
    board_id: int,
    memo_id: int,
    memo_update: schemas.MemoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        memo = crud.get_memo(db, memo_id)
        if not memo or memo.board_id != board_id:
            raise HTTPException(status_code=404, detail="Memo not found")

        if memo.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed to edit this memo")

        updated = crud.update_memo(db, memo_id, memo_update.content)
        return updated

    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error during memo update")


# Delete
@router.delete("/{memo_id}", response_model=schemas.MemoResponse, summary="메모 삭제")
def delete_memo(
    board_id: int,
    memo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    memo = crud.get_memo(db, memo_id)
    if not memo or memo.board_id != board_id:
        raise HTTPException(status_code=404, detail="Memo not found")

    if memo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this memo")

    deleted = crud.delete_memo(db, memo_id)
    return deleted
