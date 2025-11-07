from fastapi import UploadFile, File, HTTPException, APIRouter
import os, uuid

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
router = APIRouter()
BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:8000")

@router.post("/upload", summary="프로필 사진 업로드") 
async def upload_picture(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .jpg, .jpeg, .png files are allowed.")

    new_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, new_filename)

    with open(file_path, "wb") as f:
        f.write(await file.read())

    relative_path = f"/static/uploads/{new_filename}"

    return {
        "url": f"{BASE_URL}{relative_path}",  
        "path": relative_path                 
    }
