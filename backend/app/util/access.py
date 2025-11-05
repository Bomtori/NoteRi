from sqlalchemy.orm import Session
import backend.app.model as model

def can_read_board(db: Session, board_id: int, principal) -> bool:
    """
    principal:
      {"type":"user","id":<user_id>}
      {"type":"guest","board_id":<board_id>}
    """
    if not principal:
        print("🚫 principal is None")
        return False

    print(f"🔍 can_read_board: board_id={board_id}, principal={principal}")
    board = (
        db.query(model.Board)
        .filter(model.Board.id == board_id)
        .first()
    )
    if not board:
        return False

    if principal["type"] == "guest":
        # 게스트는 비번으로 들어온 그 보드만 읽을 수 있음
        return int(principal.get("board_id") or 0) == int(board_id)

    # 로그인 사용자:
    uid = principal["id"]
    if board.owner_id == uid:
        return True

    shared = (
        db.query(model.BoardShare)
        .filter(
            model.BoardShare.board_id == board_id,
            model.BoardShare.user_id == uid,
        )
        .first()
    )
    return bool(shared)
