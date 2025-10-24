# backend/app/routers/recording_results.py
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.crud.recording_result_crud import get_results_by_board
from backend.app.schemas.recording_result_schema import RecordingResultListResponse

router = APIRouter(prefix="/recording/result", tags=["recording-results"])


@router.get(
    "/{board_id}",
    response_model=RecordingResultListResponse,
    summary="보드의 (특정/최신) 세션의 RecordingResult 전체 조회",
)
def list_recording_results_by_board(
    board_id: int = Path(..., ge=1),
    session_id: Optional[int] = Query(
        None,
        description="명시하면 해당 세션의 결과를, 없으면 보드의 최신 세션 결과를 반환"
    ),
    db: Session = Depends(get_db),
):
    total, resolved_session_id, items = get_results_by_board(
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
