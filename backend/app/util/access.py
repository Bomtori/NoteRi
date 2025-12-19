# backend/app/util/access.py
from typing import Union, Optional
from sqlalchemy.orm import Session

from backend.app.model import Board, BoardShare, User
from backend.app.deps.guest import Principal


PrincipalLike = Union[Principal, User, int, None]


def can_read_board(db: Session, board_id: int, principal: PrincipalLike) -> bool:
    """
    board_id 에 대해 읽기 권한이 있는지 여부.
    - Principal(type="user") => owner 또는 share 멤버면 True
    - Principal(type="guest") => guest.board_id == board_id 이면 True
    - User / int => owner 또는 share 멤버면 True
    - None => False
    """
    if principal is None:
        return False

    # Principal 객체
    if isinstance(principal, Principal):
        if principal.is_guest:
            return principal.board_id == board_id

        if principal.is_user and principal.user:
            user_id = principal.user.id
        else:
            return False

    # User 인스턴스
    elif isinstance(principal, User):
        user_id = principal.id

    # 그냥 user_id(int) 로 들어오는 경우
    elif isinstance(principal, int):
        user_id = principal
    else:
        return False

    # 여기부터는 "user_id 가 이 보드를 볼 수 있는지" 검사
    q = (
        db.query(Board)
        .outerjoin(BoardShare, BoardShare.board_id == Board.id)
        .filter(
            Board.id == board_id,
            ((Board.owner_id == user_id) | (BoardShare.user_id == user_id)),
        )
    )
    return db.query(q.exists()).scalar()
