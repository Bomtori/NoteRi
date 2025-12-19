# backend/app/routers/board_router.py
from sqlalchemy import or_
import os
import json
import time
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from backend.app.deps.guest import get_principal, Principal
from backend.app.util.access import can_read_board
from backend.app.schemas import board_schema as schemas
from backend.app.db import get_db
from backend.app.crud import board_crud as crud, board_crud
from backend.app.deps.auth import get_current_user, get_current_user_optional
from backend.app.model import User, Board
from pydantic import BaseModel, StringConstraints
from typing import Annotated, Optional, List
from datetime import date, time
from backend.app.model import User, Board, BoardShare

import traceback
import logging



router = APIRouter(prefix="/boards", tags=["boards"])
APP_PUBLIC_ORIGIN = os.getenv("APP_PUBLIC_ORIGIN", "http://localhost:8000")
DEFAULT_TTL = int(os.getenv("LINK_TOKEN_TTL_SECONDS", "0"))
FERNET_KEY = os.getenv("FERNET_KEY")
logger = logging.getLogger(__name__)
try:
    from cryptography.fernet import Fernet, InvalidToken 
except Exception as _e: 
    raise RuntimeError("cryptography 패키지가 필요합니다: pip install cryptography") from _e

# ------------------------------
# Fernet helpers (토큰 파싱만 사용)
# ------------------------------
def _get_fernet() -> Fernet:
    if not FERNET_KEY:
        raise RuntimeError("FERNET_KEY is not set in environment")
    return Fernet(FERNET_KEY)

def _parse_link_token(t: str) -> dict:
    """
    암호화된 URL 토큰을 복호화하고(exp가 있으면 만료 검사) payload(dict)를 반환.
    """
    f = _get_fernet()
    try:
        raw = f.decrypt(t.encode("utf-8"))
        data = json.loads(raw.decode("utf-8"))
    except InvalidToken:
        raise HTTPException(status_code=401, detail="invalid token")

    exp = data.get("exp")
    if isinstance(exp, (int, float)) and time.time() > float(exp):
        raise HTTPException(status_code=401, detail="expired token")
    return data

# Create (owner는 항상 JWT의 current_user.id)
@router.post("/", response_model=schemas.BoardResponse)
def create_board(
    board: schemas.BoardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return crud.create_board(db, current_user.id, board)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/search", response_model=schemas.BoardListResponse, response_model_exclude_unset=True, summary="보드 검색")
def search_boards(
    title: Optional[str] = Query(
        None,
        description="제목 부분 검색 (LIKE)",
        example="회의",
    ),
    start_date: Optional[date] = Query(
        None,
        description="검색 시작 날짜 (YYYY-MM-DD, created_at 기준)",
        example="2025-10-01",
    ),
    end_date: Optional[date] = Query(
        None,
        description="검색 종료 날짜 (YYYY-MM-DD, created_at 기준)",
        example="2025-10-31",
    ),
    skip: int = 0,
    limit: Optional[int] = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    🔍 보드 검색 API (total + items)

    - 제목 부분 검색: /boards/search?title=회의
    - 날짜 + 제목 검색:
      /boards/search?title=회의&start_date=2025-10-01&end_date=2025-10-31
    - 날짜만으로 검색:
      /boards/search?start_date=2025-10-01&end_date=2025-10-31
    - 페이징:
      /boards/search?skip=7&limit=7
    """

    try:
        total, items = crud.search_boards(
            db=db,
            current_user=current_user,
            title=title,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
        )
        return {"total": total, "items": items}

    except SQLAlchemyError as e:
        logger.error(f"search_boards failed: {e}")
        raise HTTPException(status_code=500, detail="보드 검색 실패")

# 공유받은 회의 페이지 전용: 내가 공유받은 보드만
# @router.get("/shared-received", response_model=list[schemas.BoardResponse])
# def read_shared_received_boards(
#     skip: int = 0,
#     limit: Optional[int] = 7,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user),
# ):
#     boards = crud.get_shared_boards(db, current_user.id, skip=skip, limit=limit)
#     return boards
# 공유받은 회의 페이지 전용: 내가 공유받은 보드만 (total 추가)
@router.get("/shared-received", response_model=schemas.BoardListResponse)
def read_shared_received_boards(
    page: int = Query(1, ge=1, description="페이지 번호 (1부터 시작)"),
    limit: int = Query(7, ge=1, le=100, description="페이지당 개수"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skip = (page - 1) * limit
    
    # total count 조회
    total = (
        db.query(Board)
        .join(BoardShare, BoardShare.board_id == Board.id)
        .filter(BoardShare.user_id == current_user.id)
        .count()
    )
    
    # items 조회
    boards = crud.get_shared_boards(db, current_user.id, skip=skip, limit=limit)
    
    return {"total": total, "items": boards}

# Read all
@router.get("/", response_model=schemas.BoardListResponse)
def read_boards(
    skip: int = 0,
    limit: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from backend.app.model import Board

    total = (
        db.query(Board)
        .filter(Board.owner_id == current_user.id)
        .count()
    )

    boards = (
        db.query(Board)
        .filter(Board.owner_id == current_user.id)
        .order_by(Board.created_at.desc()) 
        .offset(skip)
        .limit(limit)
        .all()
    )

    # ⛔ 굳이 BoardListResponse(...) 직접 만들 필요 없음
    # ⭕ 이렇게 dict로만 리턴해도 Pydantic이 BoardListResponse로 변환해 줌
    return {"total": total, "items": boards}
# Recent
@router.get("/recent", response_model=list[schemas.BoardResponse], summary="최근 보드 가져오기(3개)")
def read_board_recent(limit: int = 3, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return crud.get_recent_boards(db, current_user.id, limit=limit)

# Read one
@router.get("/{board_id}", response_model=schemas.BoardResponse, description="보드 하나 읽기")
def read_board(
    board_id: int,
    t: Optional[str] = Query(None, description="URL link token (Fernet)"),
    db: Session = Depends(get_db),
    principal = Depends(get_principal),  # ✅ 게스트/유저 공통 허용
):
    # 1) 토큰이 있으면 우선 확인
    if t:
        data = _parse_link_token(t)
        bid = data.get("bid")
        if not isinstance(bid, int):
            raise HTTPException(status_code=400, detail="token missing bid")
        if bid != board_id:
            raise HTTPException(status_code=401, detail="token not for this resource")
        board = db.query(Board).filter(Board.id == board_id).first()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        return board

    # 2) 토큰 없으면 기존 권한 로직으로 판정
    if not can_read_board(db, board_id, principal):
        raise HTTPException(status_code=404, detail="Board not found or no permission")

    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board

# 보드 1개를 audio, memo, recording_sessions, summaries, final_summaries, recording_results와 함께 반환.
@router.get("/{board_id}/full", description="보드 + 하위 항목 전체 조회")
def get_board_full(
    board_id: int,
    db: Session = Depends(get_db),
    principal: Principal | None = Depends(get_principal),
):
    # 1) 보드 존재 확인
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BOARD_NOT_FOUND")

    is_protected = bool(board.password_hash)

    # 2) 로그인 유저 (owner or 공유 멤버)
    if principal is not None and principal.is_user and principal.user:
        if not can_read_board(db, board_id, principal):
            if is_protected:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="BOARD_NOT_FOUND_OR_UNAUTHORIZED",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="BOARD_NOT_SHARED",
                )

        data = board_crud.get_board_full(db, board_id)   # ✅ 인자 2개
        if not data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BOARD_NOT_FOUND")
        data["board"]["is_protected"] = is_protected
        return data

    # 3) 게스트 토큰 분기
    if principal is not None and principal.is_guest:
        if principal.board_id != board_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="GUEST_TOKEN_BOARD_MISMATCH",
            )

        data = board_crud.get_board_full(db, board_id)   # ✅ 인자 2개
        if not data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BOARD_NOT_FOUND")
        data["board"]["is_protected"] = is_protected
        return data

    # 4) 보호된 보드인데 principal 없음 → 핀 필요
    if is_protected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="BOARD_PROTECTED")

    # 5) 보호도 안돼 있고 principal 도 없음 → 공유 안 된 보드
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="BOARD_NOT_SHARED")
# Update
@router.patch("/{board_id}", response_model=schemas.BoardResponse, summary="보드 업데이트")
def update_board(board_id: int, board_update: schemas.BoardUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        board = crud.update_board(db, board_id, current_user, board_update)
        if not board:
            raise HTTPException(status_code=403, detail="No permission or board not found")
        return board
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error")

# Move 
@router.patch("/{board_id}/move", response_model=schemas.BoardResponse, summary="폴더 이동")
def move_board_endpoint(board_id: int, board_move: schemas.BoardMove, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    board = crud.move_board(db, board_id, current_user, board_move)
    if not board:
        raise HTTPException(status_code=403, detail="No permission or board not found")
    return board

# Delete 
@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT, summary="보드 삭제")
def delete_board(board_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board or board.owner_id != current_user.id:
        return Response(status_code=status.HTTP_404_NOT_FOUND)

    db.delete(board)
    db.commit()

