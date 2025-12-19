# backend/app/util/profile_upload.py (예시)
from fastapi import UploadFile, File, HTTPException, APIRouter, Depends
from pathlib import Path
from sqlalchemy.orm import Session
from backend.app.model import User
from backend.app.deps.auth import get_current_user
import os, uuid, random
from backend.app.db import get_db
router = APIRouter()

# ✅ util → app → backend → test1
BACKEND_DIR = Path(__file__).resolve().parents[3]
STATIC_DIR = BACKEND_DIR / "static"
UPLOAD_DIR = STATIC_DIR / "uploads"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}

DEFAULT_PROFILE_CANDIDATES = [
    "/static/uploads/Group_48.png",
    "/static/uploads/Group_49.png",
]

DEFAULT_BASENAMES = {"Group_48.png", "Group_49.png"}

def pick_default_profile() -> str:
    """DB에 저장할 기본 프로필 상대 경로 하나 골라줌."""
    return random.choice(DEFAULT_PROFILE_CANDIDATES)
@router.post("/upload", summary="프로필 사진 업로드")

async def upload_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .jpg, .jpeg, .png files are allowed.")

    new_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / new_filename

    print("📁 Saving file to:", file_path)  # ← 여기 반드시 backend/static/uploads/... 로 찍혀야 함

    with open(file_path, "wb") as f:
        f.write(await file.read())

    relative_path = f"/static/uploads/{new_filename}"

    # (선택) 유저 picture 바로 갱신
    user_in_db = db.query(User).filter(User.id == current_user.id).first()
    if user_in_db:
        user_in_db.picture = relative_path
        db.commit()
        db.refresh(user_in_db)

    return {"path": relative_path}

@router.delete("/picture", summary="프로필 사진 삭제")
async def delete_profile_picture(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_in_db = db.query(User).filter(User.id == current_user.id).first()
    if not user_in_db:
        raise HTTPException(status_code=404, detail="User not found")

    old_picture = user_in_db.picture

    if not old_picture:
        # 이미 기본값이거나 아무것도 없던 상태 → 그래도 기본 프사로 맞춰주자
        user_in_db.picture = pick_default_profile()
        db.commit()
        db.refresh(user_in_db)
        return {"detail": "Profile picture set to default."}

    basename = os.path.basename(old_picture)

    # 기본 프사가 아닌 경우에만 실제 파일 삭제
    if basename not in DEFAULT_BASENAMES:
        rel_path = old_picture.lstrip("/")  # 'static/uploads/xxx.png'
        file_path = BACKEND_DIR / rel_path
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception as e:
            print(f"⚠ Failed to delete profile image file: {file_path} ({e})")

    # ✅ 삭제 이후에도 DB에는 항상 기본 프로필 경로를 넣어둠 (null 금지)
    user_in_db.picture = pick_default_profile()
    db.commit()
    db.refresh(user_in_db)

    return {"detail": "Profile picture reset to default."}