# backend/app/routers/admin_users.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.db import get_db
from backend.app.util.authz      import require_admin
from backend.app.schemas.admin_user_overview_schema import AdminUserOverview, AdminUserOverviewListResponse
from backend.app.crud import admin_user_overview_crud

router = APIRouter(prefix="/admin/users", tags=["admin:users"])

@router.get("/overview-list", response_model=AdminUserOverviewListResponse, summary="운영자용 사용자 개요 리스트")
def admin_user_overview_list(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    q: str | None = Query(None, description="이름/이메일 검색"),
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    return admin_user_overview_crud.list_overviews(db, page=page, size=size, q=q)

@router.get("/{user_id}/overview", response_model=AdminUserOverview, summary="운영자용 단일 사용자 개요")
def admin_user_overview(
    user_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    res = admin_user_overview_crud.get_overview(db, user_id=user_id)
    if not res:
        raise HTTPException(status_code=404, detail="User not found")
    return res
