# backend/app/routers/board_router.py
import os
import json
import time
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from backend.app.deps.guest import get_principal
from backend.app.util.access import can_read_board
from backend.app.schemas import board_schema as schemas
from backend.app.db import get_db
from backend.app.crud import board_crud as crud
from backend.app.deps.auth import get_current_user
from backend.app.model import User, Board
from pydantic import BaseModel, StringConstraints
from typing import Annotated, Optional

router = APIRouter(prefix="/boards", tags=["boards"])
APP_PUBLIC_ORIGIN = os.getenv("APP_PUBLIC_ORIGIN", "http://localhost:8000")
DEFAULT_TTL = int(os.getenv("LINK_TOKEN_TTL_SECONDS", "0"))
FERNET_KEY = os.getenv("FERNET_KEY")

try:
    from cryptography.fernet import Fernet, InvalidToken  # type: ignore
except Exception as _e:  # pragma: no cover
    # cryptography 미설치 시 명확한 에러
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
    payload 예: {"bid": 123, "role": "viewer", "iat": 1730340000, "exp": 1730944800}
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

# Read all
@router.get("/", response_model=list[schemas.BoardResponse],  response_model_exclude_unset=True)
def read_boards(skip: int = 0, limit: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return crud.get_boards(db, current_user.id, skip=skip, limit=limit)

# Recent
@router.get("/recent", response_model=list[schemas.BoardResponse])
def read_board_recent(limit: int = 3, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return crud.get_recent_boards(db, current_user.id, limit=limit)

# Read one
@router.get("/{board_id}", response_model=schemas.BoardResponse)
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
            # 다른 보드에 대한 토큰이면 위조/오용
            raise HTTPException(status_code=401, detail="token not for this resource")
        board = db.query(Board).filter(Board.id == board_id).first()
        if not board:
            raise HTTPException(status_code=404, detail="Board not found")
        # 토큰 유효 → 바로 반환 (필요 시 추가 정책 체크)
        return board

    # 2) 토큰 없으면 기존 권한 로직으로 판정
    if not can_read_board(db, board_id, principal):
        # 권한/존재 모호화 위해 404
        raise HTTPException(status_code=404, detail="Board not found or no permission")

    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board

# Update
@router.patch("/{board_id}", response_model=schemas.BoardResponse)
def update_board(board_id: int, board_update: schemas.BoardUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        board = crud.update_board(db, board_id, current_user, board_update)
        if not board:
            raise HTTPException(status_code=403, detail="No permission or board not found")
        return board
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Database error")

# Move (owner)
@router.patch("/{board_id}/move", response_model=schemas.BoardResponse)
def move_board_endpoint(board_id: int, board_move: schemas.BoardMove, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    board = crud.move_board(db, board_id, current_user, board_move)
    if not board:
        raise HTTPException(status_code=403, detail="No permission or board not found")
    return board

# Delete (owner)
@router.delete("/{board_id}", response_model=schemas.BoardResponse)
def delete_board(board_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    board = crud.delete_board(db, current_user, board_id)
    if not board:
        raise HTTPException(status_code=403, detail="No permission or board not found")
    return board

# Verify PIN (guest)
Pin = Annotated[str, StringConstraints(pattern=r"^\d{4}$")]
class BoardPasswordVerify(BaseModel):
    password: Pin

# 비밀번호 설정
@router.post("/{board_id}/verify-password")
def verify_board_password(board_id: int, body: BoardPasswordVerify, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ok = crud.verify_board_password(db, board_id, body.password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
    return {"ok": True}

# 공유받은 회의 폴더 보드 보기
@router.get("/folder/{folder_id}", response_model=list[schemas.BoardResponse])
def read_boards_in_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    boards = crud.get_boards_in_folder(db, current_user.id, folder_id)
    if boards is None:
        raise HTTPException(status_code=404, detail="Folder not found")
    return boards