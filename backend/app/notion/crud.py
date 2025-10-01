# app/crud/notion_auth.py
from sqlalchemy.orm import Session
from app.model import NotionAuth

def save_user_notion_token(db: Session, user_id: int, access_token: str, refresh_token: str = None,
                           workspace_id: str = None, workspace_name: str = None):
    """사용자별 Notion OAuth 토큰 저장/갱신"""
    auth = db.query(NotionAuth).filter(NotionAuth.user_id == user_id).first()
    if auth:
        auth.access_token = access_token
        if refresh_token:
            auth.refresh_token = refresh_token
        if workspace_id:
            auth.workspace_id = workspace_id
        if workspace_name:
            auth.workspace_name = workspace_name
    else:
        auth = NotionAuth(
            user_id=user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            workspace_id=workspace_id,
            workspace_name=workspace_name,
        )
        db.add(auth)
    db.commit()
    db.refresh(auth)
    return auth


def get_user_notion_token(db: Session, user_id: int) -> str | None:
    """사용자의 Notion access_token 가져오기"""
    auth = db.query(NotionAuth).filter(NotionAuth.user_id == user_id).first()
    return auth.access_token if auth else None
