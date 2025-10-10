import os
from sqlalchemy.orm import Session
from datetime import datetime
from pydub import AudioSegment
from datetime import datetime, UTC
from backend.app.model import AudioData
import backend.app.schemas.audio_schema as schemas

def create_audio(db: Session, audio: schemas.AudioCreate):
    db_audio = AudioData(
        board_id=audio.board_id,
        file_path=audio.file_path,
        created_at=datetime.utcnow()
    )
    db.add(db_audio)
    db.commit()
    db.refresh(db_audio)
    return db_audio

def get_audio(db: Session, audio_id: int):
    return db.query(AudioData).filter(AudioData.id == audio_id).first()

def get_audios_by_board(db: Session, board_id: int, skip: int = 0, limit: int = 20):
    return (
        db.query(AudioData)
        .filter(AudioData.board_id == board_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

def import_audio_files(db: Session, board_id: int, base_path: str = "static/audio"):
    """
    이미 저장된 폴더 내의 오디오 파일들을 스캔하여 DB에 등록.
    base_path/board_{board_id}/ 내의 모든 파일을 AudioData로 저장
    """
    folder_path = os.path.join(base_path, f"board_{board_id}")
    if not os.path.exists(folder_path):
        raise FileNotFoundError(f"경로를 찾을 수 없습니다: {folder_path}")

    added_count = 0
    for filename in os.listdir(folder_path):
        if not filename.lower().endswith((".mp3", ".wav", ".m4a")):
            continue

        file_path = os.path.join(folder_path, filename)

        # ✅ 파일 길이 계산 (초 단위)
        try:
            audio = AudioSegment.from_file(file_path)
            duration = int(audio.duration_seconds)
        except Exception as e:
            print(f"⚠️ {filename} 재생시간 계산 실패: {e}")
            duration = None

        # ✅ DB 중복 등록 방지
        existing = db.query(AudioData).filter(AudioData.file_path == file_path).first()
        if existing:
            continue

        new_audio = AudioData(
            board_id=board_id,
            file_path=file_path.replace("\\", "/"),  # OS 경로 호환
            duration=duration,
            language="ko",  # 필요 시 자동 감지 가능 (추후 확장)
            created_at=datetime.now(UTC),
        )
        db.add(new_audio)
        added_count += 1

    db.commit()
    return added_count