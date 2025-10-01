from sqlalchemy.orm import Session
from datetime import datetime
import app.model as model
import schemas

def create_audio(db: Session, audio: schemas.AudioCreate):
    db_audio = model.AudioData(
        board_id=audio.board_id,
        file_path=audio.file_path,
        created_at=datetime.utcnow()
    )
    db.add(db_audio)
    db.commit()
    db.refresh(db_audio)
    return db_audio

def get_audio(db: Session, audio_id: int):
    return db.query(model.AudioData).filter(model.AudioData.id == audio_id).first()

def get_audios_by_board(db: Session, board_id: int, skip: int = 0, limit: int = 20):
    return (
        db.query(model.AudioData)
        .filter(model.AudioData.board_id == board_id)
        .offset(skip)
        .limit(limit)
        .all()
    )