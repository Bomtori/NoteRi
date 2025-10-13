from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserUpdate(BaseModel):
    name: str | None = None
    nickname: str | None = None
    picture: str | None = None   # URL 문자열 저장

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    nickname: Optional[str] = None
    picture: Optional[str] = None
    oauth_provider: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True