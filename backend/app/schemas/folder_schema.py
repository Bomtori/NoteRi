from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    color : Optional[str] = None

class FolderResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

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
    children: list["FolderTree"] = []  # 재귀 구조
