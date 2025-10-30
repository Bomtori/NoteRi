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
    """
    숫자 4자리만 허용. 오너만 설정/변경 가능.
    """
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

        # TODO: PIN 변경 시 기존 게스트 토큰/세션 무효화 로직이 있다면 여기서 호출
        # revoke_guest_sessions(db, board.id)

        return board
    except SQLAlchemyError:
        db.rollback()
        raise

def clear_board_password(db: Session, board_id: int, current_user_id: int) -> model.Board | None:
    """
    비밀번호 제거. 오너만 가능.
    """
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
    """
    게스트 접근/추가 검증용. 4자리 숫자만 허용.
    """
    if not (_PIN_RE.match(pin_4digits or "")):
        return False

    board = db.query(model.Board).filter(model.Board.id == board_id).first()
    if not board or not board.password_hash:
        return False
    try:
        return argon2.verify(pin_4digits, board.password_hash)
    except Exception:
        return False
