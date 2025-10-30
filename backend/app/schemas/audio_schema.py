# backend/app/schemas/audio_schema.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AudioResponse(BaseModel):
    id: int
    board_id: int
    recording_session_id: int
    file_path: str
    duration: Optional[int] = None
    language: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class AudioEnvelope(BaseModel):
    audio: Optional[AudioResponse] = None  # 없으면 null
