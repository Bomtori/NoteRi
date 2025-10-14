# routers/subscription_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.app.db import get_db
from backend.app.model import Subscription, Plan, User
from backend.app.schemas.subscription_schema import SubscriptionResponse, SubscriptionUpdate
from backend.app.deps.auth import get_current_user
from backend.app.crud import subscription_crud
from datetime import date, timedelta

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


# ✅ 구독 목록 조회
@router.get("/", response_model=List[SubscriptionResponse])
def list_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    subs = (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.id)
        .all()
    )
    return [
        SubscriptionResponse(
            id=s.id,
            user_id=s.user_id,
            plan_name=s.plan.name if s.plan else "unknown",
            start_date=s.start_date,
            end_date=s.end_date,
            is_active=s.is_active,
        )
        for s in subs
    ]


# ✅ 구독 단건 조회
@router.get("/{sub_id}", response_model=SubscriptionResponse)
def get_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.id == sub_id,
            Subscription.user_id == current_user.id
        )
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    return SubscriptionResponse(
        id=sub.id,
        user_id=sub.user_id,
        plan_name=sub.plan.name if sub.plan else "unknown",
        start_date=sub.start_date,
        end_date=sub.end_date,
        is_active=sub.is_active,
    )


# ✅ 구독 수정
@router.patch("/{sub_id}", response_model=SubscriptionResponse)
def update_subscription(
    sub_id: int,
    update: SubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.id == sub_id,
            Subscription.user_id == current_user.id
        )
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    update_data = update.dict(exclude_unset=True)

    # 플랜 변경 시 새 기간 및 plan_id 갱신
    if "plan_name" in update_data:
        new_plan = db.query(Plan).filter(Plan.name == update_data["plan_name"]).first()
        if not new_plan:
            raise HTTPException(status_code=404, detail="Invalid plan selected")

        sub.plan_id = new_plan.id
        sub.start_date = date.today()
        sub.end_date = date.today() + timedelta(days=new_plan.duration_days)

    # 활성 상태 변경
    if "is_active" in update_data:
        sub.is_active = update_data["is_active"]

    db.commit()
    db.refresh(sub)

    return SubscriptionResponse(
        id=sub.id,
        user_id=sub.user_id,
        plan_name=sub.plan.name if sub.plan else "unknown",
        start_date=sub.start_date,
        end_date=sub.end_date,
        is_active=sub.is_active,
    )


# ✅ 구독 취소
@router.patch("/{sub_id}/cancel", response_model=SubscriptionResponse)
def cancel_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.id == sub_id,
            Subscription.user_id == current_user.id
        )
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if not sub.is_active:
        raise HTTPException(status_code=400, detail="Subscription already inactive")

    # ✅ 자동 갱신만 끊고, end_date까지는 유지
    sub.is_active = False
    db.commit()
    db.refresh(sub)

    return SubscriptionResponse(
        id=sub.id,
        user_id=sub.user_id,
        plan_name=sub.plan.name if sub.plan else "unknown",
        start_date=sub.start_date,
        end_date=sub.end_date,
        is_active=sub.is_active,
    )

@router.get("/count/plan")
def get_count_by_plan(db: Session = Depends(get_db)):
    return subscription_crud.get_subscription_count_by_plan(db)
