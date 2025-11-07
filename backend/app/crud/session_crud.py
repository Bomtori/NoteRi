# backend/app/crud/recording_session_crud.py
from __future__ import annotations
from typing import List, Tuple
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import select, func

from backend.app.model import RecordingSession, RecordingResult, Summary, AudioData


def get_sessions_by_board(
    db: Session,
    board_id: int,
    *,
    limit: int | None = None,
    offset: int = 0,
) -> Tuple[int, List[RecordingSession]]:

    total = db.scalar(
        select(func.count(RecordingSession.id)).where(RecordingSession.board_id == board_id)
    ) or 0

    stmt = (
        select(RecordingSession)
        .options(
            joinedload(RecordingSession.audio),
        )
        .where(RecordingSession.board_id == board_id)
        .order_by(RecordingSession.started_at.desc())
        .offset(offset)
    )
    if limit:
        stmt = stmt.limit(limit)

    rows = db.execute(stmt).scalars().all()

    if not rows:
        return total, []

    session_ids = [s.id for s in rows]

    result_counts = dict(
        db.execute(
            select(RecordingResult.recording_session_id, func.count(RecordingResult.id))
            .where(RecordingResult.recording_session_id.in_(session_ids))
            .group_by(RecordingResult.recording_session_id)
        ).all()
    )

    summary_counts = dict(
        db.execute(
            select(Summary.recording_session_id, func.count(Summary.id))
            .where(Summary.recording_session_id.in_(session_ids))
            .group_by(Summary.recording_session_id)
        ).all()
    )
    for s in rows:
        setattr(s, "results_count", int(result_counts.get(s.id, 0)))
        setattr(s, "summaries_count", int(summary_counts.get(s.id, 0)))

    return total, rows
