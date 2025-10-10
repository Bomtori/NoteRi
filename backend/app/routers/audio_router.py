import os, uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from app.schemas import audio_schema as schemas
from app.db import get_db
from app.crud import audio_crud as crud

router = APIRouter(prefix="/audio", tags=["audio"])
UPLOAD_DIR = "static/audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)
BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:8001")
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a"}

# app/routers/audio_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.crud.audio_crud import import_audio_files

@router.post("/import/{board_id}")
def import_audio_from_folder(
    board_id: int,
    db: Session = Depends(get_db)
):
    """
    이미 존재하는 오디오 폴더의 파일들을 스캔하여 DB에 등록
    """
    try:
        count = import_audio_files(db, board_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"message": f"{count}개의 오디오 파일이 DB에 등록되었습니다."}


# ✅ 특정 오디오 조회
@router.get("/{audio_id}", response_model=schemas.AudioResponse)
def get_audio(audio_id: int, db: Session = Depends(get_db)):
    audio = crud.get_audio(db, audio_id)
    if not audio:
        raise HTTPException(status_code=404, detail="Audio not found")
    return audio

# ✅ 특정 보드의 오디오 목록 조회
@router.get("/board/{board_id}/audio", response_model=list[schemas.AudioResponse])
def get_board_audios(board_id: int, skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    audios = crud.get_audios_by_board(db, board_id, skip=skip, limit=limit)
    return audios