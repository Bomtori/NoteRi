# backend/app/schemas/final_summary_schema.py
from __future__ import annotations
from typing import List, Optional, Dict, Literal
from datetime import datetime
from pydantic import BaseModel, conint, field_validator, Field

class BulletItem(BaseModel):
    text: str

class ActionItem(BaseModel):
    text: str
    done: bool = False
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None

def _coerce_str_list_to_bullet_items(value):
    if value is None:
        return None
    # 이미 객체 배열이면 그대로
    if isinstance(value, list) and value and isinstance(value[0], dict):
        return [BulletItem(**v) for v in value]
    # 문자열 배열이면 text로 승격
    if isinstance(value, list) and (not value or isinstance(value[0], str)):
        return [BulletItem(text=str(v)) for v in value]
    return value

def _coerce_str_list_to_action_items(value):
    if value is None:
        return None
    if isinstance(value, list) and value and isinstance(value[0], dict):
        # 누락 필드 기본값 채우기
        return [ActionItem(**v) for v in value]
    if isinstance(value, list) and (not value or isinstance(value[0], str)):
        return [ActionItem(text=str(v), done=False) for v in value]
    return value

class FinalSummaryResponse(BaseModel):
    id: int
    recording_session_id: int
    title: Optional[str] = None
    bullets: Optional[List[BulletItem]] = None   # ← 응답 시 자동 변환
    actions: Optional[List[ActionItem]] = None   # ← 응답 시 자동 변환
    content: Optional[str] = None
    rating: Optional[int] = None
    created_at: Optional[datetime] = None

    # ▼ DB에서 문자열 배열이어도 응답 직전에 객체 배열로 “조회 변환”
    @field_validator("bullets", mode="before")
    @classmethod
    def _v_bullets(cls, v):
        return _coerce_str_list_to_bullet_items(v)

    @field_validator("actions", mode="before")
    @classmethod
    def _v_actions(cls, v):
        return _coerce_str_list_to_action_items(v)

    class Config:
        from_attributes = True

class FinalSummaryListResponse(BaseModel):
    board_id: int
    session_id: Optional[int]
    total: int
    items: List[FinalSummaryResponse]

class FinalSummaryRatingUpdate(BaseModel):
    rating: conint(ge=1, le=5)

class RatingSummaryOut(BaseModel):
    total: int = 0
    average: float = 0.0
    counts: Dict[Literal[1,2,3,4,5], int] = Field(default_factory=lambda:{1:0,2:0,3:0,4:0,5:0})

class FinalSummaryUpdateContent(BaseModel):
    content: str