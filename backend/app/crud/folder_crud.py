from sqlalchemy.orm import Session
from backend.app import model
from fastapi import Depends, HTTPException

from backend.app.model import Folder, User
from backend.app.schemas import folder_schema as schemas
from backend.app.deps.auth import get_current_user

def create_folder(db: Session, folder: schemas.FolderCreate, current_user: model.User):
    # 이름 중복 체크 (같은 유저 내에서 동일 이름 금지)
    exists = (
        db.query(model.Folder)
        .filter(
            model.Folder.user_id == current_user.id,
            model.Folder.name == folder.name
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="이미 동일한 이름의 폴더가 존재합니다.")

    new_folder = model.Folder(
        name=folder.name,
        parent_id=folder.parent_id,
        user_id=current_user.id
    )
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    return new_folder

#  보드 하나
def get_folder(db: Session, folder_id: int, current_user: model.User):
    return (
        db.query(model.Folder)
        .filter(model.Folder.id == folder_id, model.Folder.user_id == current_user.id)
        .first()
    )

# 모든 보드 가져오기
def get_folders(db: Session, user_id: int, skip: int = 0, limit: int = 10):
    return (
        db.query(model.Folder)
        .filter(model.Folder.user_id == user_id)
        .offset(skip)
    )
    if limit:
        query = query.limit(limit)
    return query.all()


# 폴더별 보드 목록
def get_boards_by_folder(
    db: Session,
    folder_id: int,
    skip: int = 0,
    limit: int = 7,
    owner_id: int | None = None,
):
    q = (
        db.query(model.Board)
        .join(model.Folder, model.Board.folder_id == model.Folder.id)
        .filter(model.Board.folder_id == folder_id)
    )

    if owner_id is not None:
        q = q.filter(model.Board.owner_id == owner_id)

    return (
        q.order_by(model.Board.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

# Update
def update_folder(db: Session, folder_id: int, folder_update: schemas.FolderUpdate, current_user: model.User):
    folder = (
        db.query(model.Folder)
        .filter(model.Folder.id == folder_id, model.Folder.user_id == current_user.id)
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    if folder_update.name and folder_update.name != folder.name:
        exists = (
            db.query(model.Folder)
            .filter(
                model.Folder.user_id == current_user.id,
                model.Folder.name == folder_update.name,
                model.Folder.id != folder.id,
            )
            .first()
        )
        if exists:
            raise HTTPException(status_code=400, detail="이미 동일한 이름의 폴더가 존재합니다.")

    if folder_update.name is not None:
        folder.name = folder_update.name
    if folder_update.parent_id is not None:
        folder.parent_id = folder_update.parent_id
    if folder_update.color is not None:
        folder.color = folder_update.color

    db.commit()
    db.refresh(folder)
    return folder

# Delete
def delete_folder(db: Session, folder_id: int, current_user: model.User):
    folder = (
        db.query(model.Folder)
        .filter(model.Folder.id == folder_id, model.Folder.user_id == current_user.id)
        .first()
    )
    if not folder:
        return None
    db.delete(folder)
    db.commit()
    return folder

# 트리 구조
def build_folder_tree(folder, db, user_id: int):
    children = (
        db.query(model.Folder)
        .filter(model.Folder.parent_id == folder.id, model.Folder.user_id == user_id)
        .all()
    )
    return {
        "id": folder.id,
        "name": folder.name,
        "parent_id": folder.parent_id,
        "children": [build_folder_tree(child, db, user_id) for child in children]
    }

def get_folder_tree(db: Session, user_id: int):
    roots = (
        db.query(model.Folder)
        .filter(model.Folder.parent_id == None, model.Folder.user_id == user_id)
        .all()
    )
    return [build_folder_tree(root, db, user_id) for root in roots]
