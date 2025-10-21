# backend/app/routers/plan_router.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from typing import List

from backend.app.db import get_db
from backend.app.deps.auth import get_current_user
from backend.app.model import User
from backend.app.schemas.plan_schema import (
    PlanRead, PlanCreate, PlanUpdate, PlanPriceUpdate
)
from backend.app.crud import plan_crud

router = APIRouter(prefix="/plans", tags=["Plans"])

def require_admin(user: User = Depends(get_current_user)) -> User:
    """
    - user.is_admin 이 True 이거나
    - user.role == 'admin' 이면 관리자라고 간주
    """
    if hasattr(user, "role") and getattr(user, "role", None) == "admin":
        is_admin = True

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자만 접근할 수 있습니다."
        )
    return user

# ───────────────────────────────
# 공개/일반 조회
# ───────────────────────────────
@router.get("", response_model=List[PlanRead])
def read_plans(db: Session = Depends(get_db)):
    """모든 플랜 목록 조회(공개)"""
    return plan_crud.list_plans(db)

@router.get("/{plan_id}", response_model=PlanRead)
def read_plan(plan_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    plan = plan_crud.get_plan_by_id(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan을 찾을 수 없습니다.")
    return plan

# ───────────────────────────────
# 관리자 전용 엔드포인트
# ───────────────────────────────
@router.post("", response_model=PlanRead, dependencies=[Depends(require_admin)])
def create_plan(payload: PlanCreate, db: Session = Depends(get_db)):
    """플랜 생성(관리자)"""
    return plan_crud.create_plan(db, payload)

@router.patch("/{plan_id}/price", response_model=PlanRead, dependencies=[Depends(require_admin)])
def change_plan_price(
    plan_id: int,
    payload: PlanPriceUpdate,
    db: Session = Depends(get_db),
):
    """
    플랜 가격만 변경(관리자)
    """
    return plan_crud.update_plan_price(db, plan_id, payload.price)

@router.patch("/{plan_id}", response_model=PlanRead, dependencies=[Depends(require_admin)])
def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    db: Session = Depends(get_db),
):
    """
    플랜 일부/전체 업데이트(관리자)
    - price/duration_days/allocated_minutes/description 중 일부만 보내도 됨
    """
    return plan_crud.update_plan(db, plan_id, payload)

@router.delete("/{plan_id}", status_code=204, dependencies=[Depends(require_admin)])
def remove_plan(plan_id: int, db: Session = Depends(get_db)):
    """플랜 삭제(관리자)"""
    plan_crud.delete_plan(db, plan_id)
    return None
