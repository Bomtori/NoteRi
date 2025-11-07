# backend/app/routers/board_router.py
from sqlalchemy import or_
import os
import json
import time
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from backend.app.deps.guest import get_principal
from backend.app.util.access import can_read_board
from backend.app.schemas import board_schema as schemas
from backend.app.db import get_db
from backend.app.crud import board_crud as crud, board_crud
from backend.app.deps.auth import get_current_user
from backend.app.model import User, Board
from pydantic import BaseModel, StringConstraints
from typing import Annotated, Optional
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

# 공유받은 회의 페이지 전용: 내가 공유받은 보드만
@router.get("/shared-received", response_model=list[schemas.BoardResponse])
def read_shared_received_boards(
    skip: int = 0,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    boards = crud.get_shared_boards(db, current_user.id, skip=skip, limit=limit)
    return boards

# Read all
@router.get("/", response_model=schemas.BoardListResponse, response_model_exclude_unset=True)
def read_boards(
    skip: int = 0,
    limit: Optional[int] = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        total = (
            db.query(Board)
            .outerjoin(BoardShare, BoardShare.board_id == Board.id)
            .filter(
                or_(
                    Board.owner_id == current_user.id,
                    BoardShare.user_id == current_user.id,
                )
            )
            .distinct()
            .count()
        )
        items = crud.get_boards(db, current_user.id, skip=skip, limit=limit)

        return {"total": total, "items": items}

    except SQLAlchemyError as e:
        logger.error(f"read_boards failed: {e}")
        raise HTTPException(status_code=500, detail="보드 목록 조회 실패")

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
@router.get("/{board_id}/full", description="모든 보드 가져오기 / 하위 항목 포함")
def get_board_full(
    board_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    
    data = board_crud.get_board_full(db, current_user.id, board_id)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BOARD_NOT_FOUND_OR_UNAUTHORIZED")
    return data

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
Pin = Annotated[str, StringConstraints(pattern=r"^\d{4}$")]
class BoardPasswordVerify(BaseModel):
    password: Pin

# 비밀번호 설정
@router.post("/{board_id}/verify-password", description="패스워드 설정")
def verify_board_password(board_id: int, body: BoardPasswordVerify, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ok = crud.verify_board_password(db, board_id, body.password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
    return {"ok": True}

# 공유받은 회의 페이지 전용: 내가 공유받은 보드만
@router.get("/shared-received", response_model=list[schemas.BoardResponse], summary="공유받은 보드 목록")
def read_shared_received_boards(
    skip: int = 0,
    limit: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    boards = crud.get_shared_boards(db, current_user.id, skip=skip, limit=limit)
    return boards