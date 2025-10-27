# app/core/authz.py
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.deps.auth import get_db, get_current_user   # 이미 쓰고 계신 의존성
from backend.app.model import User

ADMIN_ROLES = {"admin", "owner", "superuser"}  # 프로젝트 정의에 맞게 조정

def require_admin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    관리자만 접근 허용. (user.role == 'admin')
    """
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    if current_user.is_banned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Banned account")

    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    return current_user