# backend/app/crud/final_summary_crud.py
from __future__ import annotations
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, func

from backend.app.model import RecordingSession, FinalSummary


def _resolve_session_id_for_board(
    db: Session,
    board_id: int,
    session_id: Optional[int] = None,
) -> Optional[int]:
    """
    board_id 기준으로 사용할 recording_session_id를 결정.
    - session_id가 주어지면, 해당 세션이 그 보드에 속하는지 검증 후 반환
    - 없으면 해당 보드의 최신 세션(started_at DESC, id DESC fallback) 선택
    """
    if session_id is not None:
        rs = db.execute(
            select(RecordingSession.id).where(
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


def get_final_summaries_by_board(
    db: Session,
    board_id: int,
    *,
    session_id: Optional[int] = None,
) -> Tuple[int, int, List[FinalSummary]]:
    """
    board_id → session_id를 해석한 뒤, 해당 session의 모든 FinalSummary를 반환.
    최신순(created_at DESC, id DESC)으로 정렬.
    """
    resolved_session_id = _resolve_session_id_for_board(db, board_id, session_id)
    if resolved_session_id is None:
        return (0, 0, [])

    total = db.scalar(
        select(func.count(FinalSummary.id)).where(
            FinalSummary.recording_session_id == resolved_session_id
        )
    ) or 0

    stmt = (
        select(FinalSummary)
        .where(FinalSummary.recording_session_id == resolved_session_id)
        .order_by(desc(FinalSummary.created_at), desc(FinalSummary.id))
    )
    items = db.execute(stmt).scalars().all()
    return (total, resolved_session_id, items)


def get_latest_final_summary_by_board(
    db: Session,
    board_id: int,
    *,
    session_id: Optional[int] = None,
) -> Tuple[int, int, Optional[FinalSummary]]:
    """
    해당 session의 최신 FinalSummary 한 개만 반환.
    """
    resolved_session_id = _resolve_session_id_for_board(db, board_id, session_id)
    if resolved_session_id is None:
        return (0, 0, None)

    stmt = (
        select(FinalSummary)
        .where(FinalSummary.recording_session_id == resolved_session_id)
        .order_by(desc(FinalSummary.created_at), desc(FinalSummary.id))
        .limit(1)
    )
    latest = db.execute(stmt).scalars().first()
    return (1 if latest else 0, resolved_session_id if latest else 0, latest)
