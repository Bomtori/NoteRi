from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from enum import Enum


class RecordingType(str, Enum):
    recording = "recording"
    stopped = "stopped"
    saved = "saved"


class AudioDataResponse(BaseModel):
    id: int
    board_id: int
    recording_session_id: int
    file_path: str
    duration: Optional[int] = None
    language: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RecordingSessionResponse(BaseModel):
    id: int
    board_id: int
    user_id: int
    status: RecordingType
    started_at: datetime
    ended_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    is_diarized: bool

    # 편의 필드
    audio: Optional[AudioDataResponse] = None
    results_count: int
    summaries_count: int

    class Config:
        from_attributes = True


class RecordingSessionListResponse(BaseModel):
    total: int
    items: List[RecordingSessionResponse]
