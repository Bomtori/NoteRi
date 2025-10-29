from __future__ import annotations

from datetime import datetime, UTC
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy import or_
from passlib.hash import argon2
import re
import backend.app.model as model
from backend.app.model import Board
from backend.app.schemas import board_schema as schemas
from sqlalchemy.orm import joinedload


# -----------------------------
# Helpers
# -----------------------------
_PIN_RE = re.compile(r"^\d{4}$")

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

def _normalize_pin(pin: str) -> str:
    # 공백/개행 제거, 문자열화
    return str(pin).strip()

# -----------------------------
# Create (owner는 항상 JWT의 current_user.id)
# -----------------------------
def create_board(db: Session, current_user_id: int, data: schemas.BoardCreate):
    new_board = model.Board(
        folder_id=data.folder_id,
        owner_id=current_user_id,
        title=data.title,
        description=data.description,
        created_at=_now(),
        updated_at=_now(),
    )

    # ✅ 이중 방어: 전처리 + fullmatch + 길이 체크
    if getattr(data, "password", None):
        raw = data.password
        # ✅ 디버그 로그
        print("DEBUG create_board raw password:", repr(raw), "len:", len(str(raw)))
        pin = _normalize_pin(raw)
        print("DEBUG create_board normalized pin:", repr(pin), "len:", len(pin))
        # ✅ 실패 시 원인을 메시지로 알려주기
        if not _PIN_RE.fullmatch(pin):
            raise ValueError(f"Password must be exactly 4 digits (got={repr(pin)}, len={len(pin)})")
        new_board.password_hash = argon2.hash(pin)
    db.add(new_board)
    db.commit()
    db.refresh(new_board)
    return new_board


# -----------------------------
# Read (소유 + 공유 받은 보드)
# -----------------------------
def get_boards(db: Session, user_id: int, skip=0, limit: int | None = None):
    query = (
        db.query(Board)
        .filter(Board.owner_id == user_id)
        .options(joinedload(model.Board.folder))
        .offset(skip)
    )

    if limit is not None:  # ✅ limit 있을 때만 적용
        query = query.limit(limit)

    boards = query.all()

    result = []
    for b in boards:
        result.append({
            "id": b.id,
            "owner_id": b.owner_id,
            "title": b.title,
            "folder_id": b.folder_id,
            "description": b.description,
            "created_at": b.created_at,
            "updated_at": b.updated_at,
            "folder": (
                {
                    "id": b.folder.id,
                    "name": b.folder.name,
                    "color": b.folder.color,
                } if b.folder else None
            ),
            "audios": [
                {
                    "id": a.id,
                    "file_path": a.file_path,
                    "duration": a.duration,
                    "language": a.language,
                    "created_at": a.created_at,
                } for a in b.audios or []
            ],
            "memos": [
                {
                    "id": m.id,
                    "content": m.content,
                    "created_at": m.created_at,
                    "user_id": m.user_id,
                } for m in b.memos or []
            ]
        })
    return result

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

        if "password" in payload:
            raw = payload.pop("password")
            if raw:
                pin = _normalize_pin(raw)
                if not _PIN_RE.fullmatch(pin) or len(pin) != 4:
                    raise ValueError("Password must be exactly 4 digits.")
                board.password_hash = argon2.hash(pin)
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
        return argon2.verify(pin4, board.password_hash)
    except Exception:
        return False
