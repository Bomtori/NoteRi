from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# -----------------------------
# AudioData
# -----------------------------
class AudioResponse(BaseModel):
    id: int
    file_path: str
    duration: Optional[int]
    language: Optional[str]
    created_at: Optional[datetime]

    class Config:
        orm_mode = True


# -----------------------------
# Memo
# -----------------------------
class MemoResponse(BaseModel):
    id: int
    content: str
    created_at: Optional[datetime]
    user_id: Optional[int]

    class Config:
        orm_mode = True


# -----------------------------
# Transcript
# -----------------------------
class TranscriptResponse(BaseModel):
    id: int
    speaker_label: Optional[str]
    start_time: Optional[float]
    end_time: Optional[float]
    text: str
    created_at: Optional[datetime]

    class Config:
        orm_mode = True


# -----------------------------
# Summary
# -----------------------------
class SummaryResponse(BaseModel):
    id: int
    transcript_id: int
    summary_type: Optional[str]
    content: str
    rating: Optional[bool]
    created_at: Optional[datetime]

    class Config:
        orm_mode = True


# -----------------------------
# Board (Create / Update)
# -----------------------------
class BoardCreate(BaseModel):
    folder_id: int
    title: str
    description: Optional[str] = None
    invite_token: Optional[str] = None
    invite_role: Optional[str] = "editor"
    invite_expires_at: Optional[datetime] = None


class BoardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    invite_role: Optional[str] = None
    invite_expires_at: Optional[datetime] = None


# -----------------------------
# Board (Response)
# -----------------------------
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

    # ✅ Relationships
    audios: List[AudioResponse] = []
    memos: List[MemoResponse] = []
    transcripts: List[TranscriptResponse] = []
    summaries: List[SummaryResponse] = []

    class Config:
        orm_mode = True


# -----------------------------
# Board List Response
# -----------------------------
class BoardListResponse(BaseModel):
    boards: List[BoardResponse]


class BoardMove(BaseModel):
    folder_id: int
