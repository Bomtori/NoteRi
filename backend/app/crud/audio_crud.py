import os
from sqlalchemy.orm import Session
from datetime import datetime
from pydub import AudioSegment
from datetime import datetime, UTC
from backend.app.model import AudioData
import backend.app.schemas.audio_schema as schemas


def get_audio(db: Session, audio_id: int):
    return db.query(AudioData).filter(AudioData.id == audio_id).first()

def get_audio_by_board(db: Session, board_id: int) -> AudioData | None:
    return (
        db.query(AudioData)
        .filter(AudioData.board_id == board_id)
        .order_by(AudioData.created_at.desc().nullslast(), AudioData.id.desc())
        .first()
    )