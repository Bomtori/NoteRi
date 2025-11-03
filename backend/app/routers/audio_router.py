import os, uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse
from backend.app.crud.audio_crud import get_audio_by_board
from backend.app.schemas import audio_schema as schemas
from backend.app.db import get_db
from cryptography.fernet import Fernet, InvalidToken
from backend.app.crud import audio_crud as crud

router = APIRouter(prefix="/audio", tags=["audio"])
UPLOAD_DIR = "static/audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)
BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:8000")
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a"}

# app/routers/audio_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.db import get_db

FERNET_KEY = os.getenv("AUDIO_PATH_KEY")  # .env 에 보관
fernet = Fernet(FERNET_KEY) if FERNET_KEY else None

# ✅ 특정 오디오 조회
@router.get("/{audio_id}", response_model=schemas.AudioResponse, summary="특정 오디오 조회")
def get_audio(audio_id: int, db: Session = Depends(get_db)):
    audio = crud.get_audio(db, audio_id)
    if not audio:
        raise HTTPException(status_code=404, detail="Audio not found")
    return audio

# ✅ 특정 보드의 오디오 조회
@router.get("/board/{board_id}", response_model=schemas.AudioEnvelope, summary="특정 보드의 오디오 조회")
def get_board_audio(board_id: int, db: Session = Depends(get_db)) -> schemas.AudioEnvelope:

    audio = crud.get_audio_by_board(db, board_id)
    return schemas.AudioEnvelope(audio=audio)

@router.get("/board/{board_id}/download", summary="특정 오디오 다운로드")
def download_board_audio(board_id: int, db: Session = Depends(get_db)):
    audio = get_audio_by_board(db, board_id)
    if not audio:
        raise HTTPException(404, "Audio not found")

    if not fernet:
        raise HTTPException(500, "FERNET_KEY not configured")

    try:
        plain_path = fernet.decrypt(audio.file_path.encode()).decode()
    except InvalidToken:
        raise HTTPException(500, "Invalid audio path token")

    if not os.path.exists(plain_path):
        raise HTTPException(404, "Audio file missing on disk")

    # 경로 노출 없이 바로 전송
    return FileResponse(plain_path, media_type="audio/*", filename=os.path.basename(plain_path))