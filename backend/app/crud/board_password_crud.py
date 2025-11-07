# backend/app/crud/board_password_crud.py
from datetime import datetime, UTC
import re
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from passlib.hash import argon2
import backend.app.model as model

_PIN_RE = re.compile(r"^\d{4}$")

def _now():
    return datetime.now(UTC)

def _is_owner(board: model.Board, user_id: int) -> bool:
    return board.owner_id == user_id

def set_board_password(db: Session, board_id: int, current_user_id: int, pin_4digits: str) -> model.Board | None:
    if not (_PIN_RE.match(pin_4digits or "")):
        raise ValueError("Password must be exactly 4 digits.")

    board = db.query(model.Board).filter(model.Board.id == board_id).first()
    if not board or not _is_owner(board, current_user_id):
        return None

    try:
        board.password_hash = argon2.hash(pin_4digits)
        board.updated_at = _now()
        db.commit()
        db.refresh(board)

        # revoke_guest_sessions(db, board.id)

        return board
    except SQLAlchemyError:
        db.rollback()
        raise

def clear_board_password(db: Session, board_id: int, current_user_id: int) -> model.Board | None:
    board = db.query(model.Board).filter(model.Board.id == board_id).first()
    if not board or not _is_owner(board, current_user_id):
        return None

    try:
        board.password_hash = None
        board.updated_at = _now()
        db.commit()
        db.refresh(board)
        return board
    except SQLAlchemyError:
        db.rollback()
        raise

def verify_board_password(db: Session, board_id: int, pin_4digits: str) -> bool:
    if not (_PIN_RE.match(pin_4digits or "")):
        return False

    board = db.query(model.Board).filter(model.Board.id == board_id).first()
    if not board or not board.password_hash:
        return False
    try:
        return argon2.verify(pin_4digits, board.password_hash)
    except Exception:
        return False
