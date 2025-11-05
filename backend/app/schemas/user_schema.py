from pydantic import BaseModel, Field
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
    role : str
    created_at: datetime
    updated_at: datetime
    plan_name: Optional[str] = None
    plan_id: Optional[int] = None

    class Config:
        orm_mode = True

class PlanUserCount(BaseModel):
    plan: str  # "free" | "pro" | "enterprise"
    user_count: int

class BanUpdateRequest(BaseModel):
    is_banned: bool
    reason: Optional[str] = None
    until: Optional[datetime] = None

class BanStatusResponse(BaseModel):
    user_id: int
    is_banned: bool
    banned_reason: Optional[str] = None
    banned_until: Optional[datetime] = None

class UserMeResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    role: str
    is_banned: bool
    banned_reason: Optional[str] = None
    banned_until: Optional[datetime] = None

    class Config:
        orm_mode = True

class BanInfoResponse(BaseModel):
    user_id: int
    is_banned: bool
    banned_reason: Optional[str] = None
    banned_until: Optional[datetime] = None
    remaining_seconds: Optional[int] = None  # None=영구밴, 0=만료됨/해제 가능

    class Config:
        orm_mode = True