from __future__ import annotations
from typing import List, Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy import desc
from backend.app import model

from backend.app.model import FinalSummary, RecordingSession

# 단건
def get(db: Session, final_summary_id: int) -> Optional[FinalSummary]:
    return db.query(FinalSummary).get(final_summary_id)

# 세션별 목록
def list_by_session(
    db: Session,
    session_id: int,
    order: str = "desc",
) -> List[FinalSummary]:
    q = db.query(FinalSummary).filter(FinalSummary.recording_session_id == session_id)
    q = q.order_by(desc(FinalSummary.created_at)) if order == "desc" else q.order_by(FinalSummary.created_at)
    return q.all()

# 세션 최신 1건
def latest_by_session(
    db: Session,
    session_id: int,
) -> Optional[FinalSummary]:
    return (
        db.query(FinalSummary)
        .filter(FinalSummary.recording_session_id == session_id)
        .order_by(desc(FinalSummary.created_at))
        .first()
    )

# 보드별 목록 (RecordingSession 조인)
def list_by_board(
    db: Session,
    board_id: int,
    order: str = "desc",
) -> List[FinalSummary]:
    q = (
        db.query(FinalSummary)
        .join(RecordingSession, RecordingSession.id == FinalSummary.recording_session_id)
        .filter(RecordingSession.board_id == board_id)
    )
    q = q.order_by(desc(FinalSummary.created_at)) if order == "desc" else q.order_by(FinalSummary.created_at)
    return q.all()

# 수정(PATCH)
def update(
    db: Session,
    final_summary_id: int,
    data: Dict[str, Any],
) -> Optional[FinalSummary]:
    obj = db.query(FinalSummary).get(final_summary_id)
    if not obj:
        return None

    # 넘어온 필드만 반영
    for key in ("title", "bullets", "actions", "content", "rating"):
        if key in data:
            setattr(obj, key, data[key])

    db.commit()
    db.refresh(obj)
    return obj

# 평점만 별도 업데이트 (옵션)
def update_rating(
    db: Session,
    final_summary_id: int,
    rating: int,
) -> Optional[FinalSummary]:
    obj = db.query(FinalSummary).get(final_summary_id)
    if not obj:
        return None
    obj.rating = rating
    db.commit()
    db.refresh(obj)
    return obj

def get_final_summary_by_session(db, session_id: int):
    FS = model.FinalSummary
    # session_id가 없으면 recording_session_id를 사용
    col = getattr(FS, "session_id", None) or getattr(FS, "recording_session_id", None)
    if col is None:
        raise RuntimeError(
            "FinalSummary 모델에 session_id / recording_session_id 컬럼이 없습니다."
        )

    stmt = (
        select(FS)
        .where(col == session_id)
        .order_by(FS.id.desc())
        .limit(1)
    )
    return db.execute(stmt).scalars().first()