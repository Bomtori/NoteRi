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
    """
    주어진 board_id에 속한 모든 RecordingSession을 시작시간 최신순으로 반환.
    - audio(1:1) joinload
    - results, summaries는 count만 수행
    """
    # 전체 개수
    total = db.scalar(
        select(func.count(RecordingSession.id)).where(RecordingSession.board_id == board_id)
    ) or 0

    # 항목 조회 (audio만 조인로드)
    stmt = (
        select(RecordingSession)
        .options(
            joinedload(RecordingSession.audio),  # 1:1이므로 joinedload 적합
        )
        .where(RecordingSession.board_id == board_id)
        .order_by(RecordingSession.started_at.desc())
        .offset(offset)
    )
    if limit:
        stmt = stmt.limit(limit)

    rows = db.execute(stmt).scalars().all()

    # 각 세션별 results_count, summaries_count 계산 (N개 id 모아서 한 번에 카운트)
    if not rows:
        return total, []

    session_ids = [s.id for s in rows]

    # 결과 카운트
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

    # 편의 속성으로 달아두면 Pydantic from_attributes로 직렬화 가능
    for s in rows:
        setattr(s, "results_count", int(result_counts.get(s.id, 0)))
        setattr(s, "summaries_count", int(summary_counts.get(s.id, 0)))

    return total, rows