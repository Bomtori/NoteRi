from __future__ import annotations

from pydantic import BaseModel, Field, constr, validator
from typing import Optional, List
from datetime import datetime

# ---------- Create / Update ----------

class FolderCreate(BaseModel):
    name: constr(strip_whitespace=True, min_length=1)
    parent_id: Optional[int] = Field(default=None, ge=1)
    color: Optional[constr(pattern=r"^#[0-9A-Fa-f]{6}$")] = None

    @validator("name")
    def name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("이름은 비어 있을 수 없습니다.")
        return v

class FolderUpdate(BaseModel):
    name: Optional[constr(strip_whitespace=True, min_length=1)] = None
    parent_id: Optional[int] = Field(default=None, ge=1)
    color: Optional[constr(pattern=r"^#[0-9A-Fa-f]{6}$")] = None

    @validator("name")
    def name_not_empty_if_given(cls, v):
        if v is not None and not v.strip():
            raise ValueError("이름은 비어 있을 수 없습니다.")
        return v

# ---------- Responses ----------

class FolderResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    color: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class FolderListResponse(BaseModel):
    folders: List[FolderResponse]

class FolderBase(BaseModel):
    id: int
    name: str
    parent_id: int | None = None

    class Config:
        orm_mode = True

class FolderTree(FolderBase):
    children: List["FolderTree"] = Field(default_factory=list)
