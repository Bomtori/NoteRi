from __future__ import annotations
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List, Optional
from datetime import datetime, UTC

import backend.app.model as model

_ALLOWED_ROLES = {"viewer", "editor"}

def _now():
    return datetime.now(UTC)

def _get_board_owned(db: Session, board_id: int, owner_id: int) -> Optional[model.Board]:
    board = db.query(model.Board).filter(model.Board.id == board_id).first()
    if not board or board.owner_id != owner_id:
        return None
    return board

def _find_user_by_email(db: Session, email: str) -> Optional[model.User]:
    # 이메일 소문자 normalize
    e = email.strip().lower()
    return db.query(model.User).filter(model.User.email.ilike(e)).first()

def list_shares(db: Session, board_id: int, owner_id: int) -> List[model.BoardShare]:
    board = _get_board_owned(db, board_id, owner_id)
    if not board:
        return []
    return (
        db.query(model.BoardShare)
        .filter(model.BoardShare.board_id == board_id)
        .order_by(model.BoardShare.created_at.desc())
        .all()
    )

def add_or_update_share_by_email(db: Session, board_id: int, owner_id: int, email: str, role: str) -> Optional[model.BoardShare]:
    if role not in _ALLOWED_ROLES:
        raise ValueError("Invalid role")
    board = _get_board_owned(db, board_id, owner_id)
    if not board:
        return None

    target = _find_user_by_email(db, email)
    if not target or not target.is_active:
        raise LookupError("Target user not found or inactive")

    if target.id == owner_id:
        raise ValueError("Owner cannot be shared to themselves")
    # 보드 오너에게 또 공유 설정은 무의미하므로 차단

    share = (
        db.query(model.BoardShare)
        .filter(
            model.BoardShare.board_id == board_id,
            model.BoardShare.user_id == target.id,
        )
        .first()
    )

    try:
        if share:
            share.role = role
            # updated_at이 없다면 board.updated_at만 갱신
        else:
            share = model.BoardShare(board_id=board_id, user_id=target.id, role=role)
            db.add(share)

        board.updated_at = _now()
        db.commit()
        db.refresh(share)
        return share
    except IntegrityError:
        db.rollback()
        # unique 제약 충돌 방지용 안전망
        share = (
            db.query(model.BoardShare)
            .filter(
                model.BoardShare.board_id == board_id,
                model.BoardShare.user_id == target.id,
            )
            .first()
        )
        return share
    except SQLAlchemyError:
        db.rollback()
        raise

def update_share_role(db: Session, board_id: int, owner_id: int, target_user_id: int, role: str) -> Optional[model.BoardShare]:
    if role not in _ALLOWED_ROLES:
        raise ValueError("Invalid role")
    board = _get_board_owned(db, board_id, owner_id)
    if not board:
        return None

    share = (
        db.query(model.BoardShare)
        .filter(
            model.BoardShare.board_id == board_id,
            model.BoardShare.user_id == target_user_id,
        )
        .first()
    )
    if not share:
        return None
    try:
        share.role = role
        board.updated_at = _now()
        db.commit()
        db.refresh(share)
        return share
    except SQLAlchemyError:
        db.rollback()
        raise

def remove_share(db: Session, board_id: int, owner_id: int, target_user_id: int) -> bool:
    board = _get_board_owned(db, board_id, owner_id)
    if not board:
        return False
    share = (
        db.query(model.BoardShare)
        .filter(
            model.BoardShare.board_id == board_id,
            model.BoardShare.user_id == target_user_id,
        )
        .first()
    )
    if not share:
        return False
    try:
        db.delete(share)
        board.updated_at = _now()
        db.commit()
        return True
    except SQLAlchemyError:
        db.rollback()
        raise
