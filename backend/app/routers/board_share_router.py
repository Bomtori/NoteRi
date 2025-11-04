from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.crud.board_share_crud import get_board_members
from backend.app.db import get_db
from backend.app.deps.auth import get_current_user
from backend.app.deps.guest import get_principal
from backend.app.model import User, Board, BoardShare
from backend.app.schemas.board_share_schema import (
    ShareCreateByEmail, ShareUpdateRole, ShareResponse, BoardShareUserInfo
)
from backend.app.crud import board_share_crud as crud
from backend.app.util.access import can_read_board

router = APIRouter(prefix="/boards/{board_id}/shares", tags=["boards:share"])

def _to_resp(s, include_user=False) -> ShareResponse:
    # s: model.BoardShare
    return ShareResponse(
        id=s.id,
        board_id=s.board_id,
        user_id=s.user_id,
        role=s.role,
        created_at=s.created_at,
        user_email=(s.user.email if include_user and s.user else None),
        user_name=(s.user.name if include_user and s.user else None),
    )


# 공유한 보드 멤버 불러오기
@router.get("/members", response_model=list[BoardShareUserInfo])
def list_board_members(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # ✅ 로그인 유저만
):
    # 1️⃣ 오너인지 확인
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    if board.owner_id != current_user.id:
        # 2️⃣ 공유받은 멤버인지 확인
        shared = (
            db.query(BoardShare)
            .filter(
                BoardShare.board_id == board_id,
                BoardShare.user_id == current_user.id,
            )
            .first()
        )
        if not shared:
            raise HTTPException(status_code=403, detail="Access denied")

    # 3️⃣ 멤버 목록 조회
    members = get_board_members(db, board_id)
    if members is None:
        raise HTTPException(status_code=404, detail="Board not found")

    return members

# 목록 (오너만 조회 가능)
@router.get("/", response_model=list[ShareResponse])
def list_board_shares(
    board_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shares = crud.list_shares(db, board_id, current_user.id)
    if shares == []:
        # 보드가 없거나 소유자가 아니면 빈 배열이 오므로 404로 정리
        # (원한다면 빈 배열 그대로 200 처리도 가능)
        # 여기서는 보안상 404 권장
        # 다만 '공유가 0개'인 정상 케이스도 있으니 아래처럼 분기:
        #   - 보드 미소유: None을 리턴하도록 CRUD 바꾸고 여기서 404
        pass
    return [_to_resp(s, include_user=True) for s in shares]

# 추가/업서트 (이메일로)
@router.post("/", response_model=ShareResponse)
def add_share_by_email(
    board_id: int,
    payload: ShareCreateByEmail,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        s = crud.add_or_update_share_by_email(
            db, board_id, current_user.id, payload.email, payload.role
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    if not s:
        raise HTTPException(status_code=404, detail="Board not found")
    return _to_resp(s, include_user=True)

# 역할 변경 (user_id로)
@router.patch("/{target_user_id}", response_model=ShareResponse)
def update_share(
    board_id: int,
    target_user_id: int,
    payload: ShareUpdateRole,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        s = crud.update_share_role(
            db, board_id, current_user.id, target_user_id, payload.role
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not s:
        raise HTTPException(status_code=404, detail="Board or share not found")
    return _to_resp(s, include_user=True)

# 공유 해제 (user_id로)
@router.delete("/{target_user_id}")
def remove_share(
    board_id: int,
    target_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = crud.remove_share(db, board_id, current_user.id, target_user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Board or share not found")
    return {"ok": True}

