from pydantic import BaseModel, EmailStr, constr
from typing import Optional
from datetime import datetime

# 권한 값 제한 (원하면 Literal["viewer","editor"]로 엄격화 가능)
RoleStr = constr(strip_whitespace=True, to_lower=True, pattern=r"^(viewer|editor)$")

class ShareCreateByEmail(BaseModel):
    email: EmailStr
    role: RoleStr = "viewer"

class ShareUpdateRole(BaseModel):
    role: RoleStr

class ShareResponse(BaseModel):
    id: int
    board_id: int
    user_id: int
    role: str
    created_at: Optional[datetime]

    # UX 편의를 위해 표시 필드(선택)
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        orm_mode = True
