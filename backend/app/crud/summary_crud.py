from __future__ import annotations
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from backend.app.model import Summary, RecordingSession, Board

def get(db: Session, summary_id: int) -> Optional[Summary]:
    return db.query(Summary).get(summary_id)

def list_by_session(
    db: Session,
    session_id: int,
    *,
    summary_type: Optional[str] = None,
    order: str = "asc",
) -> List[Summary]:
    q = db.query(Summary).filter(Summary.recording_session_id == session_id)
    if summary_type:
        q = q.filter(Summary.summary_type == summary_type)
    if order == "desc":
        q = q.order_by(desc(Summary.created_at))
    else:
        q = q.order_by(Summary.created_at)
    return q.all()

def latest_by_session(
    db: Session,
    session_id: int,
    *,
    summary_type: Optional[str] = None,
) -> Optional[Summary]:
    q = db.query(Summary).filter(Summary.recording_session_id == session_id)
    if summary_type:
        q = q.filter(Summary.summary_type == summary_type)
    return q.order_by(desc(Summary.created_at)).first()

def list_by_board(
    db: Session,
    board_id: int,
    *,
    summary_type: Optional[str] = None,
    order: str = "desc",
) -> List[Summary]:
    # RecordingSession.board_id로 조인해서 해당 보드의 모든 요약
    q = (
        db.query(Summary)
        .join(RecordingSession, RecordingSession.id == Summary.recording_session_id)
        .filter(RecordingSession.board_id == board_id)
    )
    if summary_type:
        q = q.filter(Summary.summary_type == summary_type)
    if order == "asc":
        q = q.order_by(Summary.created_at)
    else:
        q = q.order_by(desc(Summary.created_at))
    return q.all()

def update(
    db: Session,
    summary_id: int,
    **fields,
) -> Optional[Summary]:
    obj = db.query(Summary).get(summary_id)
    if not obj:
        return None
    for k, v in fields.items():
        if v is not None:
            setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj
