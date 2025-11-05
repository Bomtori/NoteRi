from __future__ import annotations
from typing import List, Optional
from datetime import date, timedelta, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from backend.app.db import get_db
from backend.app.model import Subscription, Plan, User
from backend.app.schemas.subscription_schema import (
    SubscriptionResponse,
    SubscriptionUpdate,
    PlanUserCount,
)
from backend.app.crud.subscription_crud import get_subscription_count_by_plan
from backend.app.deps.auth import get_current_user  # 이미 쓰고 있던 의존성이라 유지

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# 내 구독 목록
@router.get("/", response_model=List[SubscriptionResponse], summary="내 구독 목록 조회")
def list_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
            updated_at=s.updated_at,
            is_active=s.is_active,
        )
        for s in subs
    ]

# 내 최신(주요) 구독
@router.get("/me", response_model=SubscriptionResponse, summary="내 구독 조회")
def get_my_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy.orm import joinedload
    from sqlalchemy import desc

    print("✅ current_user.id =", current_user.id)

    sub = (
        db.query(Subscription)
          .options(joinedload(Subscription.plan))
          .filter(Subscription.user_id == current_user.id)
          .order_by(desc(Subscription.updated_at))   # ✅ 가장 최근 업데이트된 순으로 정렬
          .first()
    )

    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    print(f"🎯 최신 구독 ID={sub.id}, plan_name={sub.plan.name if sub.plan else 'unknown'}")

    return {
        "id": sub.id,
        "user_id": sub.user_id,
        "plan_id": sub.plan_id,           # ✅ 추가
        "plan_name": sub.plan.name if sub.plan else "unknown",
        "start_date": sub.start_date,
        "end_date": sub.end_date,
        "updated_at": sub.updated_at,
        "is_active": sub.is_active,
    }

# 내 구독 수정 (플랜 변경 또는 활성/비활성)
@router.patch("/me", response_model=SubscriptionResponse, summary="내 구독 변경")
def update_my_subscription(
    update: SubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = (
        db.query(Subscription)
          .filter(Subscription.user_id == current_user.id)
          .order_by(Subscription.start_date.desc().nullslast())
          .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    # 플랜 변경
    if update.plan_name is not None:
        new_plan = db.query(Plan).filter(Plan.name == update.plan_name).first()
        if not new_plan:
            raise HTTPException(status_code=404, detail="Invalid plan selected")
        sub.plan_id = new_plan.id
        # 플랜 변경 시 구독 기간 갱신이 필요하다면 여기에서 처리
        if hasattr(new_plan, "duration_days") and new_plan.duration_days:
            sub.start_date = date.today()
            sub.end_date = date.today() + timedelta(days=int(new_plan.duration_days))

    # 활성/비활성 토글
    if update.is_active is not None:
        sub.is_active = update.is_active

    # updated_at 수동 보정 (모델에 onupdate 없을 때)
    # func.now() 할당은 일부 DB에서 기대대로 동작하지 않을 수 있으니, 애플리케이션 시간으로 갱신
    sub.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(sub)

    return SubscriptionResponse(
        id=sub.id,
        user_id=sub.user_id,
        plan_name=sub.plan.name if sub.plan else "unknown",
        start_date=sub.start_date,
        end_date=sub.end_date,
        updated_at=sub.updated_at,
        is_active=sub.is_active,
    )

# 내 구독 취소 (is_active=False 만 처리, end_date는 유지)
@router.patch("/me/cancel", response_model=SubscriptionResponse, summary="구독 취소")
def cancel_my_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = (
        db.query(Subscription)
          .filter(Subscription.user_id == current_user.id)
          .order_by(Subscription.start_date.desc().nullslast())
          .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if not sub.is_active:
        raise HTTPException(status_code=400, detail="Subscription already inactive")

    sub.is_active = False
    sub.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(sub)

    return SubscriptionResponse(
        id=sub.id,
        user_id=sub.user_id,
        plan_name=sub.plan.name if sub.plan else "unknown",
        start_date=sub.start_date,
        end_date=sub.end_date,
        updated_at=sub.updated_at,
        is_active=sub.is_active,
    )

# 플랜별 유저 수 집계 (프론트: PricingBreakdownCard 등에서 사용)
@router.get("/count/plan", response_model=List[PlanUserCount], summary="플랜별 유저 수 집계")
def get_plan_user_counts(
    db: Session = Depends(get_db),
    as_of: Optional[date] = Query(None, description="이 날짜에 유효한 구독만 집계"),
    active_only: bool = Query(True, description="is_active=True만 집계"),
    date_from: Optional[date] = Query(None, description="구간 시작 (start_date 기준)"),
    date_to: Optional[date] = Query(None, description="구간 끝 (start_date 기준)"),
):
    rows = get_subscription_count_by_plan(
        db,
        as_of=as_of,
        active_only=active_only,
        date_from=date_from,
        date_to=date_to,
    )
    return [{"plan": plan, "user_count": cnt} for plan, cnt in rows]
