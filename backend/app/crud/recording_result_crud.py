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
    """
    board_id 기준으로 사용할 recording_session_id를 결정.
    - session_id가 있으면 해당 세션이 그 보드에 속하는지 확인
    - 없으면 해당 보드의 가장 최근 세션(started_at DESC)을 선택
    """
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
    """
    board_id → session_id를 해석한 뒤, 해당 session의 모든 RecordingResult를 반환.
    """
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
