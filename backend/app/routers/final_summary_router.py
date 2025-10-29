# backend/app/routers/final_summaries.py
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from pydantic import BaseModel, Field
from typing import Dict, Literal
from backend.app.db import get_db
from backend.app.crud.final_summary_crud import (
    get_final_summaries_by_board,
    get_latest_final_summary_by_board, set_final_summary_rating,
list_final_summaries_by_board
)

from backend.app.model import FinalSummary
from backend.app.schemas.final_summary_schema import (
    FinalSummaryListResponse,
    FinalSummaryResponse, FinalSummaryRatingUpdate,
)

router = APIRouter(prefix="/summary/final", tags=["final-summaries"])

class RatingSummaryOut(BaseModel):
    total: int = 0
    average: float = 0.0
    counts: Dict[Literal[1,2,3,4,5], int] = Field(default_factory=lambda:{1:0,2:0,3:0,4:0,5:0})

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
@router.get(
    "/{board_id}/final-summaries",
    response_model=FinalSummaryListResponse,
    summary="보드의 (특정/최신) 세션의 FinalSummary 전체 조회",
)
def list_final_summaries_by_board(
    board_id: int = Path(..., ge=1),
    session_id: Optional[int] = Query(
        None, description="명시하면 해당 세션의 FinalSummary들, 없으면 보드의 최신 세션 FinalSummary들"
    ),
    db: Session = Depends(get_db),
):
    total, resolved_session_id, items = get_final_summaries_by_board(
        db, board_id, session_id=session_id
    )

    # ✅ 세션이 없으면 null과 빈 배열로 반환 (404 아님)
    if resolved_session_id == 0:
        return {
            "board_id": board_id,
            "session_id": None,
            "total": 0,
            "items": [],
        }

    return {
        "board_id": board_id,
        "session_id": resolved_session_id,
        "total": total,
        "items": items,
    }

@router.get(
    "/{board_id}/latest",
    response_model=FinalSummaryResponse,
    summary="보드의 (특정/최신) 세션에서 가장 최근 FinalSummary 1건 조회",
)
def read_latest_final_summary_by_board(
    board_id: int = Path(..., ge=1),
    session_id: Optional[int] = Query(
        None, description="명시하면 해당 세션의 최신 FinalSummary, 없으면 보드의 최신 세션에서 최신 FinalSummary"
    ),
    db: Session = Depends(get_db),
):
    _, resolved_session_id, latest = get_latest_final_summary_by_board(
        db, board_id, session_id=session_id
    )
    if not latest or resolved_session_id == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No final summary found for this board/session.",
        )
    return latest

# 평가 점수 설정
@router.patch("/{final_summary_id}/rating", response_model=FinalSummaryResponse)
def update_final_summary_rating(
    final_summary_id: int = Path(..., ge=1),
    body: FinalSummaryRatingUpdate = ...,
    db: Session = Depends(get_db),
):
    fs = set_final_summary_rating(db, final_summary_id, body.rating)
    if not fs:
        raise HTTPException(status_code=404, detail="FinalSummary not found")
    return fs

