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

@router.get("/{user_id}/overview", response_model=AdminUserOverview, summary="운영자용 단일 사용자 개요(+결제내역)")
def admin_user_overview(
    user_id: int,
    include_payments: bool = Query(True, description="결제 내역 포함 여부"),
    payments_limit: int = Query(50, ge=1, le=500, description="결제 내역 최대 개수"),
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    res = admin_user_overview_crud.get_overview(
        db,
        user_id=user_id,
        include_payments=include_payments,
        payments_limit=payments_limit,
    )
    if not res:
        raise HTTPException(status_code=404, detail="User not found")
    return res

# (선택) 결제만 별도로 불러오는 엔드포인트도 제공하면 프론트에서 무한스크롤/추가 로딩이 편함
from typing import List
from backend.app.schemas.admin_user_overview_schema import AdminUserPayment

@router.get("/{user_id}/payments", response_model=List[AdminUserPayment], summary="특정 유저 결제 내역만 조회")
def admin_user_payments(
    user_id: int,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    # 내부 CRUD 재사용
    payments = admin_user_overview_crud._fetch_user_payments(db, user_id, limit=limit)  # pylint: disable=protected-access
    return payments