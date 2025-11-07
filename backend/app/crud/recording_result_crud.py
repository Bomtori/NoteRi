# backend/app/crud/recording_result_crud.py
from __future__ import annotations
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, func

from backend.app.model import RecordingSession, RecordingResult


def _resolve_session_id_for_board(
    db: Session,
    board_id: int,
    session_id: Optional[int] = None,
) -> Optional[int]:
    if session_id is not None:
        rs = db.execute(
            select(RecordingSession.id)
            .where(
                RecordingSession.id == session_id,
                RecordingSession.board_id == board_id,
            )
        ).scalar_one_or_none()
        return rs

    return db.execute(
        select(RecordingSession.id)
        .where(RecordingSession.board_id == board_id)
        .order_by(desc(RecordingSession.started_at), desc(RecordingSession.id))
        .limit(1)
    ).scalar_one_or_none()


def get_results_by_board(
    db: Session,
    board_id: int,
    *,
    session_id: Optional[int] = None,
) -> Tuple[int, int, List[RecordingResult]]:

    resolved_session_id = _resolve_session_id_for_board(db, board_id, session_id)
    if resolved_session_id is None:
        return (0, 0, [])

    total = db.scalar(
        select(func.count(RecordingResult.id))
        .where(RecordingResult.recording_session_id == resolved_session_id)
    ) or 0

    stmt = (
        select(RecordingResult)
        .where(RecordingResult.recording_session_id == resolved_session_id)
        .order_by(RecordingResult.started_at.asc().nulls_last(), RecordingResult.id.asc())
    )

    items = db.execute(stmt).scalars().all()
    return (total, resolved_session_id, items)
