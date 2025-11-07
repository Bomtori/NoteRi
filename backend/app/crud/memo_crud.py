from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime, UTC
import backend.app.model as model
from backend.app.schemas import memo_schema as schemas


# 보드 생성 시 자동 메모 생성
def create_default_memo(db: Session, board_id: int, user_id: int):
    new_memo = model.Memo(
        board_id=board_id,
        user_id=user_id,
        content="새 메모",
        created_at=datetime.now(UTC)
    )
    db.add(new_memo)
    db.commit()
    db.refresh(new_memo)
    return new_memo


# 특정 보드의 메모 조회
def get_memo_by_board(db: Session, board_id: int):
    return (
        db.query(model.Memo)
        .filter(model.Memo.board_id == board_id)
        .first()
    )

# 단일 메모 조회
def get_memo(db: Session, memo_id: int):
    return db.query(model.Memo).filter(model.Memo.id == memo_id).first()


# 메모 수정
def update_memo(db: Session, memo_id: int, content: str):
    try:
        memo = db.query(model.Memo).filter(model.Memo.id == memo_id).first()
        if not memo:
            return None

        memo.content = content
        db.commit()
        db.refresh(memo)
        return memo

    except SQLAlchemyError:
        db.rollback()
        raise


# 메모 삭제
def delete_memo(db: Session, memo_id: int):
    memo = db.query(model.Memo).filter(model.Memo.id == memo_id).first()
    if not memo:
        return None

    db.delete(memo)
    db.commit()
    return memo
