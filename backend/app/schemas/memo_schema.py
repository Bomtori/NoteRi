from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# ✅ Memo 생성용
class MemoCreate(BaseModel):
    content: str

# ✅ Memo 수정용 (부분 업데이트)
class MemoUpdate(BaseModel):
    content: Optional[str] = None

# ✅ Memo 응답용
class MemoResponse(BaseModel):
    id: int
    board_id: int
    user_id: Optional[int]
    content: str
    created_at: Optional[datetime]

    class Config:
        orm_mode = True
