from sqlalchemy.orm import Session
from app import model
from . import schemas

# Create
def create_folder(db: Session, folder: schemas.FolderCreate, user_id: int):
    new_folder = model.Folder(
        name=folder.name,
        parent_id=folder.parent_id,
        user_id=user_id
    )
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    return new_folder

# Read one
def get_folder(db: Session, folder_id: int, user_id: int):
    return (
        db.query(model.Folder)
        .filter(model.Folder.id == folder_id, model.Folder.user_id == user_id)
        .first()
    )

# Read all
def get_folders(db: Session, user_id: int, skip: int = 0, limit: int = 10):
    return (
        db.query(model.Folder)
        .filter(model.Folder.user_id == user_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

# ✅ 폴더별 보드 목록
def get_boards_by_folder(db: Session, folder_id: int, user_id: int):
    return (
        db.query(model.Board)
        .join(model.Folder, model.Board.folder_id == model.Folder.id)
        .filter(
            model.Board.folder_id == folder_id,
            model.Folder.user_id == user_id
        )
        .all()
    )

# Update
def update_folder(db: Session, folder_id: int, folder_update: schemas.FolderUpdate, user_id: int):
    folder = (
        db.query(model.Folder)
        .filter(model.Folder.id == folder_id, model.Folder.user_id == user_id)
        .first()
    )
    if not folder:
        return None

    if folder_update.name is not None:
        folder.name = folder_update.name
    if folder_update.parent_id is not None:
        folder.parent_id = folder_update.parent_id

    db.commit()
    db.refresh(folder)
    return folder

# Delete
def delete_folder(db: Session, folder_id: int, user_id: int):
    folder = (
        db.query(model.Folder)
        .filter(model.Folder.id == folder_id, model.Folder.user_id == user_id)
        .first()
    )
    if not folder:
        return None
    db.delete(folder)
    db.commit()
    return folder

# ✅ 트리 구조
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
