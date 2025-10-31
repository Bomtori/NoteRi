from __future__ import annotations
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from fastapi import HTTPException
from typing import List, Optional
from datetime import datetime, UTC
from backend.app.model import User, BoardShare, Board, Notification

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

def add_or_update_share_by_email(db: Session, board_id: int, owner_id: int, email: str, role: str):
    """
    이메일로 보드 공유 생성 or 업데이트
    - 예외 발생 시 rollback 보장
    - 기존 공유 시 role 업데이트
    - 새 공유 시 알림(Notification) 생성
    """
    try:
        # 1️⃣ 대상 사용자 찾기
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise LookupError("해당 이메일의 사용자가 존재하지 않습니다.")
        if user.id == owner_id:
            raise ValueError("자기 자신에게는 공유할 수 없습니다.")

        # 2️⃣ 기존 공유가 있으면 역할만 변경
        share = (
            db.query(BoardShare)
            .filter(BoardShare.board_id == board_id, BoardShare.user_id == user.id)
            .first()
        )

        if share:
            share.role = role
            db.commit()
            db.refresh(share)
        else:
            # 3️⃣ 새 공유 추가
            share = BoardShare(board_id=board_id, user_id=user.id, role=role)
            db.add(share)
            db.commit()
            db.refresh(share)

        # 4️⃣ 알림 등록 (선택)
        board = db.query(Board).filter(Board.id == board_id).first()
        owner = db.query(User).filter(User.id == owner_id).first()
        if board and owner:
            notif = Notification(
                user_id=user.id,
                # title="새로운 회의가 공유되었습니다",
                content=f"{owner.name or '누군가'}님이 '{board.title}'을(를) 공유했습니다.",
                created_at=datetime.now(UTC),
            )
            db.add(notif)
            db.commit()

        return share

    # ✅ 예외 처리 (rollback 포함)
    except LookupError as e:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(e))

    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB 제약 조건 위반: {str(e)}")

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    
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
