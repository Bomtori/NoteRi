from __future__ import annotations

from datetime import datetime, UTC
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy import or_
from passlib.hash import bcrypt

import backend.app.model as model
from backend.app.schemas import board_schema as schemas


# -----------------------------
# Helpers
# -----------------------------
def _now():
    return datetime.now(UTC)

def _is_owner(board: model.Board, user_id: int) -> bool:
    return board.owner_id == user_id

def _shared_role(db: Session, board_id: int, user_id: int) -> Optional[str]:
    share = (
        db.query(model.BoardShare)
        .filter(
            model.BoardShare.board_id == board_id,
            model.BoardShare.user_id == user_id,
        )
        .first()
    )
    return share.role if share else None

def _can_read(db: Session, board: model.Board, user_id: int) -> bool:
    return _is_owner(board, user_id) or _shared_role(db, board.id, user_id) is not None

def _can_edit(db: Session, board: model.Board, user_id: int) -> bool:
    if _is_owner(board, user_id):
        return True
    role = _shared_role(db, board.id, user_id)
    return role in ("editor", "owner")


# -----------------------------
# Create (owner는 항상 JWT의 current_user.id)
# -----------------------------
def create_board(db: Session, current_user_id: int, data: schemas.BoardCreate):
    new_board = model.Board(
        folder_id=data.folder_id,
        owner_id=current_user_id,  # 👈 JWT에서만 결정
        title=data.title,
        description=data.description,
        created_at=_now(),
        updated_at=_now(),
    )

    # 선택: 4자리 PIN 비밀번호(있다면) → 해시 저장
    if getattr(data, "password", None):
        new_board.password_hash = bcrypt.hash(data.password)

    db.add(new_board)
    db.commit()
    db.refresh(new_board)

    # 기본 메모 생성(프로젝트 기존 로직 유지)
    from backend.app.crud import memo_crud
    memo_crud.create_default_memo(db, new_board.id, current_user_id)

    return new_board


# -----------------------------
# Read (소유 + 공유 받은 보드)
# -----------------------------
def get_boards(db: Session, current_user_id: int, skip: int = 0, limit: int = 10):
    return (
        db.query(model.Board)
        .outerjoin(model.BoardShare, model.BoardShare.board_id == model.Board.id)
        .filter(
            or_(
                model.Board.owner_id == current_user_id,
                model.BoardShare.user_id == current_user_id,
            )
        )
        .order_by(model.Board.updated_at.desc().nullslast())
        .offset(skip)
        .limit(limit)
        .distinct()
        .all()
    )


def get_board(db: Session, current_user_id: int, board_id: int):
    board = db.query(model.Board).filter(model.Board.id == board_id).first()
    if not board:
        return None
    return board if _can_read(db, board, current_user_id) else None


def get_recent_boards(db: Session, current_user_id: int, limit: int = 3):
    return (
        db.query(model.Board)
        .outerjoin(model.BoardShare, model.BoardShare.board_id == model.Board.id)
        .filter(
            or_(
                model.Board.owner_id == current_user_id,
                model.BoardShare.user_id == current_user_id,
            )
        )
        .order_by(model.Board.created_at.desc().nullslast())
        .limit(limit)
        .distinct()
        .all()
    )


# -----------------------------
# Update (owner 또는 editor 이상만)
# -----------------------------
def update_board(db: Session, board_id: int, current_user: model.User, update: schemas.BoardUpdate):
    try:
        board = db.query(model.Board).filter(model.Board.id == board_id).first()
        if not board or not _can_edit(db, board, current_user.id):
            return None

        payload = update.dict(exclude_unset=True)

        # 4자리 PIN 비밀번호 변경/해제
        if "password" in payload:
            pwd = payload.pop("password")
            if pwd:
                board.password_hash = bcrypt.hash(pwd)
            else:
                board.password_hash = None

        for k, v in payload.items():
            setattr(board, k, v)

        board.updated_at = _now()
        db.commit()
        db.refresh(board)
        return board
    except SQLAlchemyError:
        db.rollback()
        raise


# -----------------------------
# Move (오너만)
# -----------------------------
def move_board(db: Session, board_id: int, current_user: model.User, move: schemas.BoardMove):
    board = db.query(model.Board).filter(model.Board.id == board_id).first()
    if not board or not _is_owner(board, current_user.id):
        return None
    board.folder_id = move.folder_id
    board.updated_at = _now()
    db.commit()
    db.refresh(board)
    return board


# -----------------------------
# Delete (오너만)
# -----------------------------
def delete_board(db: Session, current_user: model.User, board_id: int):
    board = db.query(model.Board).filter(model.Board.id == board_id).first()
    if not board or not _is_owner(board, current_user.id):
        return None
    db.delete(board)
    db.commit()
    return board


# -----------------------------
# Verify password (게스트/추가 검증용)
# -----------------------------
def verify_board_password(db: Session, board_id: int, pin4: str) -> bool:
    board = db.query(model.Board).filter(model.Board.id == board_id).first()
    if not board or not board.password_hash:
        return False
    try:
        # PIN 형식 검사는 라우터에서 수행(정규식) — 여기선 해시 검증만
        return bcrypt.verify(pin4, board.password_hash)
    except Exception:
        return False
