from __future__ import annotations
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from backend.app.db import get_db
from backend.app.model import RecordingSession, Board, User, FinalSummary
from backend.app.deps.auth import get_current_user
from backend.app.crud import final_summary_crud
from backend.app.schemas.final_summary_schema import (
    FinalSummaryResponse,
    FinalSummaryListResponse,
    FinalSummaryRatingUpdate, RatingSummaryOut,
)

router = APIRouter(prefix="/summary/final", tags=["final_summary"])

# --- 권한 체크(간단: 보드 소유자만) ---
def _assert_session_access(db: Session, session_id: int, user: User):
    session = db.query(RecordingSession).get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="RecordingSession not found")
    board = db.query(Board).get(session.board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    if board.owner_id != user.id:
        # 공유 권한 허용하려면 여기에 share 체크 추가
        raise HTTPException(status_code=403, detail="No permission for this session")

def _assert_board_access(db: Session, board_id: int, user: User):
    board = db.query(Board).get(board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    if board.owner_id != user.id:
        raise HTTPException(status_code=403, detail="No permission for this board")

# 평가 점수 가져오기
@router.get("/ratings", response_model=RatingSummaryOut)
def get_rating_summary(db: Session = Depends(get_db)):
    rows = db.execute(
        select(FinalSummary.rating, func.count(FinalSummary.id))
        .where(FinalSummary.rating.isnot(None))
        .group_by(FinalSummary.rating)
    ).all()

    counts = {1:0,2:0,3:0,4:0,5:0}
    total = 0
    ssum = 0
    for rating, count in rows:
        if rating and 1 <= rating <= 5:
            counts[int(rating)] = int(count)
            total += int(count)
            ssum += int(rating) * int(count)

    average = round(ssum/total, 2) if total else 0.0
    return {"total": total, "average": average, "counts": counts}


# ------------------------------
# 단건 조회
# ------------------------------
@router.get("/{final_summary_id}", response_model=FinalSummaryResponse)
def get_final_summary(
    final_summary_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = final_summary_crud.get(db, final_summary_id)
    if not obj:
        raise HTTPException(status_code=404, detail="FinalSummary not found")
    _assert_session_access(db, obj.recording_session_id, current_user)
    return obj  # ← 응답 스키마에서 bullets/actions 변환

# ------------------------------
# 세션별 목록
# ------------------------------
@router.get("/sessions/{session_id}", response_model=FinalSummaryListResponse)
def list_final_summaries_by_session(
    session_id: int = Path(..., ge=1),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_session_access(db, session_id, current_user)
    items = final_summary_crud.list_by_session(db, session_id, order=order)
    return {
        "board_id": db.query(RecordingSession).get(session_id).board_id,
        "session_id": session_id,
        "total": len(items),
        "items": items,  # ← 각 item 직렬화 시 변환
    }

# ------------------------------
# 세션 최신 1건
# ------------------------------
@router.get("/sessions/{session_id}/latest", response_model=FinalSummaryResponse)
def latest_final_summary_by_session(
    session_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_session_access(db, session_id, current_user)
    obj = final_summary_crud.latest_by_session(db, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="No final summary found")
    return obj

# ------------------------------
# 보드별 목록
# ------------------------------
@router.get("/boards/{board_id}", response_model=FinalSummaryListResponse)
def list_final_summaries_by_board(
    board_id: int = Path(..., ge=1),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_board_access(db, board_id, current_user)
    items = final_summary_crud.list_by_board(db, board_id, order=order)
    # session_id는 단일 값이 아니므로 목록에선 None으로 반환(스키마가 허용)
    return {
        "board_id": board_id,
        "session_id": None,
        "total": len(items),
        "items": items,
    }

# ------------------------------
# 수정(PATCH)
# ------------------------------
@router.patch("/{final_summary_id}", response_model=FinalSummaryResponse)
def update_final_summary(
    final_summary_id: int = Path(..., ge=1),
    payload: Dict[str, Any] = Body(...),  # ← 그대로 저장
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = final_summary_crud.get(db, final_summary_id)
    if not obj:
        raise HTTPException(status_code=404, detail="FinalSummary not found")
    _assert_session_access(db, obj.recording_session_id, current_user)

    updated = final_summary_crud.update(db, final_summary_id, payload)
    return updated

# ------------------------------
# 평점만 별도(PATCH)
# ------------------------------
@router.patch("/{final_summary_id}/rating", response_model=FinalSummaryResponse)
def update_final_summary_rating(
    final_summary_id: int = Path(..., ge=1),
    payload: FinalSummaryRatingUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = final_summary_crud.get(db, final_summary_id)
    if not obj:
        raise HTTPException(status_code=404, detail="FinalSummary not found")
    _assert_session_access(db, obj.recording_session_id, current_user)

    updated = final_summary_crud.update_rating(db, final_summary_id, payload.rating)
    return updated

