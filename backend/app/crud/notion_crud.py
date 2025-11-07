# app/crud/notion_crud.py
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.model import NotionAuth
from backend.app.util.auth import verify_token

def _extract_bearer_token(authorization: str = Header(..., alias="Authorization")) -> str:
    """
    Authorization 헤더에서 'Bearer <token>' 형태의 JWT를 추출.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'",
        )

    return parts[1]


def _user_id_from_jwt(token: str) -> int:
    payload = verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing 'sub'",
        )

    try:
        return int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: 'sub' must be an integer",
        )

def save_user_notion_token(
    db: Session,
    user_id: int,
    access_token: str,
    refresh_token: Optional[str] = None,
    workspace_id: Optional[str] = None,
    workspace_name: Optional[str] = None,
) -> NotionAuth:
   
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


def get_user_notion_token(
    db: Session = Depends(get_db),
    token: str = Depends(_extract_bearer_token),  # Authorization: Bearer <JWT>
) -> Optional[str]:

    user_id = _user_id_from_jwt(token)
    auth = db.query(NotionAuth).filter(NotionAuth.user_id == user_id).first()
    return auth.access_token if auth else None


# 선택: 전체 auth 레코드를 조회해야 하는 경우에 쓸 수 있는 헬퍼
def get_user_notion_auth(
    db: Session = Depends(get_db),
    token: str = Depends(_extract_bearer_token),
) -> Optional[NotionAuth]:

    user_id = _user_id_from_jwt(token)
    return db.query(NotionAuth).filter(NotionAuth.user_id == user_id).first()
