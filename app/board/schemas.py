from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ✅ Board 생성 요청
class BoardCreate(BaseModel):
    folder_id: int
    title: str
    description: Optional[str] = None
    invite_token: Optional[str] = None
    invite_role: Optional[str] = "editor"
    invite_expires_at: Optional[datetime] = None

# ✅ Board 수정 요청
class BoardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    invite_role: Optional[str] = None
    invite_expires_at: Optional[datetime] = None


# ✅ Board 응답
class BoardResponse(BaseModel):
    id: int
    folder_id: int
    owner_id: int
    title: str
    description: Optional[str]
    invite_token: Optional[str]
    invite_role: Optional[str]
    invite_expires_at: Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True
