from sqlalchemy.orm import Session
from sqlalchemy import and_
import app.model as model
from . import schemas

def create_board(db: Session, user_id: int, board: schemas.BoardCreate):
    new_board = model.Board(
        folder_id=board.folder_id,
        owner_id=user_id,
        title=board.title,
        description=board.description,
        invite_token=board.invite_token,
        invite_role=board.invite_role or "editor",
        invite_expires_at=board.invite_expires_at,
    )
    db.add(new_board)
    db.commit()
    db.refresh(new_board)
    return new_board


def get_boards(db: Session, user_id: int, skip: int = 0, limit: int = 10):
    return (
        db.query(model.Board)
        .filter(and_(model.Board.owner_id == user_id, model.Board.is_active == True))  # ✅ and_ 사용
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_board(db: Session, user_id: int, board_id: int):
    return (
        db.query(model.Board)
        .filter(and_(model.Board.id == board_id, model.Board.owner_id == user_id))  # ✅ and_ 사용
        .first()
    )


def update_board(db: Session, user_id: int, board_id: int, board_update: schemas.BoardUpdate):
    board = (
        db.query(model.Board)
        .filter(and_(model.Board.id == board_id, model.Board.owner_id == user_id))  # ✅ and_ 사용
        .first()
    )
    if not board:
        return None

    if board_update.title is not None:
        board.title = board_update.title
    if board_update.description is not None:
        board.description = board_update.description
    if board_update.invite_role is not None:
        board.invite_role = board_update.invite_role
    if board_update.invite_expires_at is not None:
        board.invite_expires_at = board_update.invite_expires_at

    db.commit()
    db.refresh(board)
    return board


def delete_board(db: Session, user_id: int, board_id: int):
    board = (
        db.query(model.Board)
        .filter(and_(model.Board.id == board_id, model.Board.owner_id == user_id))  # ✅ and_ 사용
        .first()
    )
    if not board:
        return None
    db.delete(board)
    db.commit()
    return board