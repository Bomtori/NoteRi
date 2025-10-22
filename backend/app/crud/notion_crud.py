# app/crud/notion_crud.py
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.model import NotionAuth
from backend.app.util.auth import verify_token  # ✅ 분리된 키 구조에 맞춘 검증기 사용


# -----------------------------
# Helpers
# -----------------------------
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
    """
    JWT 디코드하여 user_id(sub)를 획득.
    Access/Refresh 분리 구조: 반드시 access 토큰으로만 검증.
    """
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


# -----------------------------
# CRUD
# -----------------------------
def save_user_notion_token(
    db: Session,
    user_id: int,
    access_token: str,
    refresh_token: Optional[str] = None,
    workspace_id: Optional[str] = None,
    workspace_name: Optional[str] = None,
) -> NotionAuth:
    """
    사용자별 Notion OAuth 토큰 저장/갱신 (upsert)
    - access_token: 필수, 매 갱신 시 덮어씀
    - refresh_token: 제공된 경우에만 갱신(일부 리프레시 플로우에서 refresh_token이 안 내려올 수 있음)
    - workspace_id/name: 제공된 경우에만 갱신
    """
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
    """
    JWT(Authorization 헤더) → user_id(sub) 추출 → DB에서 Notion access_token 조회
    """
    user_id = _user_id_from_jwt(token)
    auth = db.query(NotionAuth).filter(NotionAuth.user_id == user_id).first()
    return auth.access_token if auth else None


# 선택: 전체 auth 레코드를 조회해야 하는 경우에 쓸 수 있는 헬퍼
def get_user_notion_auth(
    db: Session = Depends(get_db),
    token: str = Depends(_extract_bearer_token),
) -> Optional[NotionAuth]:
    """
    JWT 기반 user_id로 NotionAuth 전체 레코드 조회 (access_token 외 정보가 필요할 때 사용)
    """
    user_id = _user_id_from_jwt(token)
    return db.query(NotionAuth).filter(NotionAuth.user_id == user_id).first()
