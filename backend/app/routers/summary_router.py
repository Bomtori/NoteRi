from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.db import get_db
from backend.app.model import RecordingSession, Board, User
from backend.app.schemas.summary_schema import (
    SummaryUpdate, SummaryResponse, SummaryListResponse
)
from backend.app.crud import summary_crud
from backend.app.deps.auth import get_current_user  # 프로젝트 기존 의존성 사용

router = APIRouter(prefix="/summaries", tags=["summaries"])

def _assert_session_access(db: Session, session_id: int, user: User):
    session = db.query(RecordingSession).get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="RecordingSession not found")

    # 권한 정책: 세션의 보드 소유자이거나 공유 사용자면 허용
    # 프로젝트에 board_shares 권한 체크 헬퍼가 있다면 그걸 사용하세요.
    board = db.query(Board).get(session.board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    if board.owner_id != user.id:
        # 공유 권한 여부를 추가로 검사하려면 여기서 처리
        # 단순히 소유자만 허용하려면 아래 한 줄로 충분
        raise HTTPException(status_code=403, detail="No permission for this session")


@router.get("/{summary_id}", response_model=SummaryResponse, summary="특정 요약 조회")
def read_summary(
    summary_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = summary_crud.get(db, summary_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Summary not found")

    # 접근 제어: 요약의 세션 → 보드 확인
    _assert_session_access(db, obj.recording_session_id, current_user)
    return obj

@router.get(
    "/sessions/{session_id}",
    response_model=SummaryListResponse, summary="특정 세션에 속한 요약 조회"
)
def list_summaries_by_session(
    session_id: int = Path(..., ge=1),
    summary_type: Optional[str] = Query(None, description="예: final / interval"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _assert_session_access(db, session_id, current_user)
    items = summary_crud.list_by_session(db, session_id, summary_type=summary_type, order=order)
    return {"summaries": items}


@router.get(
    "/boards/{board_id}",
    response_model=SummaryListResponse, summary="특정 보드에 속한 요약 조회"
)
def list_summaries_by_board(
    board_id: int = Path(..., ge=1),
    summary_type: Optional[str] = Query(None),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 보드 접근 권한 체크(간단히 소유자만 허용)
    board = db.query(Board).get(board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    if board.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No permission for this board")

    items = summary_crud.list_by_board(db, board_id, summary_type=summary_type, order=order)
    return {"summaries": items}

@router.patch("/{summary_id}", response_model=SummaryResponse, summary="요약 수정")
def update_summary(
    summary_id: int = Path(..., ge=1),
    payload: SummaryUpdate = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = summary_crud.get(db, summary_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Summary not found")
    _assert_session_access(db, obj.recording_session_id, current_user)

    updated = summary_crud.update(
        db,
        summary_id,
        summary_type=payload.summary_type,
        content=payload.content,
        interval_start_at=payload.interval_start_at,
        interval_end_at=payload.interval_end_at,
        model=payload.model,
        tokens_input=payload.tokens_input,
        tokens_output=payload.tokens_output,
    )
    return updated


