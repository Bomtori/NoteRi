# backend/app/routers/plan_router.py
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session, joinedload        # ✅ joinedload 추가
from sqlalchemy import func, desc                     # ✅ func, desc 추가
from datetime import date
from typing import List

from backend.app.db import get_db
from backend.app.schemas.plan_schema import (
    PlanRead, PlanCreate, PlanUpdate, PlanPriceUpdate
)
from backend.app.model import User, Subscription, Plan
from backend.app.crud import plan_crud
from backend.app.util.authz import require_admin
from backend.app.deps.auth import get_current_user

router = APIRouter(prefix="/plans", tags=["Plans"])

@router.get("", response_model=List[PlanRead], summary="플랜 조회")
def read_plans(db: Session = Depends(get_db)):
    return plan_crud.list_plans(db)

@router.get("/me", response_model=PlanRead)
def get_my_current_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    print(f"\n{'='*80}")
    print(f"🔵 /plans/me 호출 (User ID: {current_user.id})")

    db.expire_all()

    # ✅ is_active=True + start_date 기준 최신 구독
    sub = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(
            Subscription.user_id == current_user.id,
            Subscription.is_active == True
        )
        .order_by(desc(Subscription.start_date))
        .first()
    )

    if not sub or not sub.plan:
        print("⚠️ 유효한 구독 없음 → free 반환")
        free_plan = db.query(Plan).filter(func.lower(Plan.name) == "free").first()
        if not free_plan:
            raise HTTPException(status_code=404, detail="Free plan not found")
        return free_plan

    # ✅ 만료 체크
    today = date.today()
    if sub.end_date and sub.end_date < today:
        print("⚠️ 구독 만료 → free 반환")
        free_plan = db.query(Plan).filter(func.lower(Plan.name) == "free").first()
        return free_plan

    print(f"✅ 현재 플랜: {sub.plan.name}")
    return sub.plan

@router.get("/{plan_id}", response_model=PlanRead, summary="특정 플랜 조회")
def read_plan(plan_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    plan = plan_crud.get_plan_by_id(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan을 찾을 수 없습니다.")
    return plan

@router.post("", response_model=PlanRead, dependencies=[Depends(require_admin)], summary="플랜 생성")
def create_plan(payload: PlanCreate, db: Session = Depends(get_db)):
    """플랜 생성(관리자)"""
    return plan_crud.create_plan(db, payload)

@router.patch("/{plan_id}", response_model=PlanRead, dependencies=[Depends(require_admin)], summary="플랜 변경")
def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    db: Session = Depends(get_db),
):
    return plan_crud.update_plan(db, plan_id, payload)

@router.delete("/{plan_id}", status_code=204, dependencies=[Depends(require_admin)], summary="플랜 삭제")
def remove_plan(plan_id: int, db: Session = Depends(get_db)):
    """플랜 삭제(관리자)"""
    plan_crud.delete_plan(db, plan_id)
    return None