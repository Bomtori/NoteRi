from pydantic import BaseModel, StringConstraints, ConfigDict, Field
from typing import Optional, List, Annotated
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
# 4자리 숫자 PIN
Pin = Annotated[str, StringConstraints(pattern=r"^\d{4}$")]

# -----------------------------
# Board (Create / Update)
# -----------------------------
class BoardCreate(BaseModel):
    folder_id: Optional[int] = None  # 🍒 수정 10.23 frontend /int 필수제외
    title: str
    description: Optional[str] = None
    password: Optional[Pin] = None

class BoardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    password: Optional[Pin] = None

# -----------------------------
# Board (Response)
# -----------------------------
class BoardResponse(BaseModel):
    id: int
    folder_id: Optional[int] = None
    owner_id: int
    title: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # ✅ 1:N 관계 → 리스트로 변경해야 함
    audios: List[AudioResponse] = Field(default_factory=list)
    memos: List[MemoResponse] = Field(default_factory=list)
    transcripts: List[TranscriptResponse] = Field(default_factory=list)
    summaries: List[SummaryResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

class BoardListResponse(BaseModel):
    boards: List[BoardResponse]
    model_config = ConfigDict(from_attributes=True)

class BoardMove(BaseModel):
    folder_id: int

class BoardListResponse(BaseModel):
    boards: List[BoardResponse]
    model_config = ConfigDict(from_attributes=True)

class BoardMove(BaseModel):
    folder_id: int