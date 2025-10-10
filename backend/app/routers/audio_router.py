import os, uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.app.schemas import audio_schema as schemas
from backend.app.db import get_db
from backend.app.crud import audio_crud as crud

router = APIRouter()
UPLOAD_DIR = "static/audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)
BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:8001")
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a"}


@router.post("/audio/upload", response_model=schemas.AudioResponse)
async def upload_audio(
    board_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # 확장자 체크
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only mp3, wav, m4a files are allowed.")

    # 파일명 unique 처리
    new_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join("audio", new_filename)  # 상대 경로 저장 / DB
    save_path = os.path.join(UPLOAD_DIR, new_filename) # 절대 경로 저장 / 실제 저장 경로

    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # DB 저장
    audio_in = schemas.AudioCreate(board_id=board_id, file_path=file_path)
    audio = crud.create_audio(db, audio_in)

    return {
        "url" : f"{BASE_URL}{save_path}",
        "path" : file_path
    }

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