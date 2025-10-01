from pydantic import BaseModel
from datetime import datetime

class AudioBase(BaseModel):
    board_id: int
    file_path: str

class AudioCreate(AudioBase):
    pass

class AudioResponse(AudioBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
