from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.schemas import folder_schema as schemas
from backend.app.crud import folder_crud as crud
from backend.app.db import get_db
from backend.app.schemas.board_schema import BoardResponse
from backend.app.deps.auth import get_current_user
from backend.app.model import User, Folder  # 타입 힌트용
from typing import Optional


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
    limit: Optional[int] = None, # 🍒 10.24 front /DB에 20개 폴더가 있어도 10개만 반환됨 수정
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
@router.patch("/{folder_id}")
def update_folder(folder_id: int, folder_update: schemas.FolderUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    folder = db.query(Folder).filter(Folder.id == folder_id, Folder.user_id == current_user.id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # if folder_update.name:
    #     folder.name = folder_update.name
    # if folder_update.color:
    #     folder.color = folder_update.color
    # 🍒 10.24 front/ 컬럼누락, 관계직렬화 에러 수정 | 필요한 필드만 업데이트
    if folder_update.name is not None:
        folder.name = folder_update.name
    if folder_update.color is not None:
        folder.color = folder_update.color

    db.commit()
    db.refresh(folder)
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
