from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.schemas import folder_schema as schemas
from backend.app.crud import folder_crud as crud
from backend.app.db import get_db
from backend.app.schemas.board_schema import BoardResponse
from backend.app.deps.auth import get_current_user
from backend.app.model import User, Folder
from typing import Optional

router = APIRouter(prefix="/folders", tags=["folders"])


# Create
@router.post("/", response_model=schemas.FolderResponse, summary="폴더 생성")
def create_folder(
    folder: schemas.FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return crud.create_folder(db, folder, current_user)

# Read all

@router.get("/", response_model=schemas.FolderListResponse, summary="폴더 가져오기")
def read_folders(
    skip: int = 0,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folders = crud.get_folders(db, current_user.id, skip=skip, limit=limit)
    return {"folders": folders}

# Read one
@router.get("/{folder_id}", response_model=schemas.FolderResponse, summary="특정 폴더 가져오기")
def read_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folder = crud.get_folder(db, folder_id, current_user.id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder

# 폴더별 보드 조회
@router.get("/{folder_id}/boards", response_model=list[BoardResponse], summary="폴더의 보드목록 가져오기")
def read_boards_by_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    boards = crud.get_boards_by_folder(db, folder_id)
    return boards

# Update
@router.patch("/{folder_id}", response_model=schemas.FolderResponse, summary="폴더 업데이트")
def update_folder(
    folder_id: int,
    folder_update: schemas.FolderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = (
        db.query(Folder)
        .filter(Folder.id == folder_id, Folder.user_id == current_user.id)
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    for key, value in folder_update.dict(exclude_unset=True).items():
        setattr(folder, key, value)

    db.commit()
    db.refresh(folder)
    return folder


# Delete 
@router.delete("/{folder_id}", response_model=schemas.FolderResponse, summary="폴더 삭제")
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = crud.delete_folder(db, folder_id, current_user)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found or no permission")
    return folder


# 트리 구조 조회
@router.get("/tree", response_model=list[schemas.FolderTree], summary="폴더 구조 조회")
def read_folder_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return crud.get_folder_tree(db, user_id=current_user.id)
