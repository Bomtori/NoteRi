from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas import folder_schema as schemas
from app.crud import folder_crud as crud
from app.db import get_db
from app.schemas.board_schema import BoardResponse
from app.deps.auth import get_current_user
from app.model import User  # 타입 힌트용

router = APIRouter(prefix="/folders", tags=["folders"])


# Create
@router.post("/", response_model=schemas.FolderResponse)
def create_folder(
    folder: schemas.FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return crud.create_folder(db, folder, current_user)

# Read all
@router.get("/", response_model=schemas.FolderListResponse)
def read_folders(
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folders = crud.get_folders(db, user_id=current_user.id, skip=skip, limit=limit)
    return {"folders": folders}

# Read one
@router.get("/{folder_id}", response_model=schemas.FolderResponse)
def read_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folder = crud.get_folder(db, folder_id, current_user)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder

# 폴더별 보드 조회
@router.get("/{folder_id}/boards", response_model=list[BoardResponse])
def read_boards_by_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    boards = crud.get_boards_by_folder(db, folder_id)
    return boards

# Update
@router.patch("/{folder_id}", response_model=schemas.FolderResponse)
def update_folder(
    folder_id: int,
    folder_update: schemas.FolderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folder = crud.update_folder(db, folder_id, folder_update, current_user)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found or no permission")
    return folder

# Delete
@router.delete("/{folder_id}", response_model=schemas.FolderResponse)
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folder = crud.delete_folder(db, folder_id, current_user)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found or no permission")
    return folder

# 트리 구조 조회
@router.get("/tree", response_model=list[schemas.FolderTree])
def read_folder_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return crud.get_folder_tree(db, user_id=current_user.id)
