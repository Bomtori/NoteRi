# backend/app/routers/final_summaries.py
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.crud.final_summary_crud import (
    get_final_summaries_by_board,
    get_latest_final_summary_by_board,
)
from backend.app.schemas.final_summary_schema import (
    FinalSummaryListResponse,
    FinalSummaryResponse,
)

router = APIRouter(prefix="/summary/final", tags=["final-summaries"])


@router.get(
    "/{board_id}",
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
    if resolved_session_id == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No recording session found for this board (or session_id doesn't belong to this board).",
        )
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
