from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy import and_
import app.model as model
from datetime import datetime, UTC
from app.schemas import board_schema as schemas


def create_board(db: Session, user_id: int, board: schemas.BoardCreate):
    new_board = model.Board(
        folder_id=board.folder_id,
        owner_id=user_id,
        title=board.title,
        description=board.description,
        invite_token=board.invite_token,
        invite_role=board.invite_role or "editor",
        invite_expires_at=board.invite_expires_at,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    db.add(new_board)
    db.commit()
    db.refresh(new_board)
    return new_board


def get_boards(db: Session, user_id: int, skip: int = 0, limit: int = 10):
    return (
        db.query(model.Board)
        .filter(and_(model.Board.owner_id == user_id))  # ✅ and_ 사용
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

def get_recent_boards(db: Session, user_id: int, limit: int = 3):
    return(
        db.query(model.Board)
        .filter(model.Board.owner_id == user_id)
        .order_by(model.Board.created_at.desc())
        .limit(limit)
        .all()
    )

def update_board(db: Session, board_id: int, board_update: schemas.BoardUpdate):
    try:
        board = (
            db.query(model.Board)
            .filter(and_(model.Board.id == board_id, model.Board.owner_id == board_update.user_id))
            .first()
        )

        if not board:
            return None

        # 업데이트 가능한 필드만 반영
        update_data = board_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(board, key, value)
        board.updated_at = datetime.now()
        db.commit()
        db.refresh(board)
        return board

    except SQLAlchemyError:
        db.rollback()
        raise

def move_board(db: Session, board_id: int, board_move: schemas.BoardMove):
    board = (
        db.query(model.Board)
        .filter(and_(model.Board.owner_id == board_move.user_id, model.Board.id == board_id))
        .first()
    )
    if not board:
        return None

    # 폴더 이동
    board.folder_id = board_move.folder_id

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