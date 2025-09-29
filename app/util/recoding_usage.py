from datetime import date, timedelta, datetime, UTC
from sqlalchemy.orm import Session
from app.model import Subscription, RecodingUsage, PlanType


def get_plan_minutes(plan: PlanType) -> int | None:
    if plan == PlanType.free:
        return 300
    elif plan == PlanType.pro:
        return 500
    elif plan == PlanType.enterprise:
        return None  # 무제한
    return 0

def update_recoding_usage(db: Session, user_id: int, subscription: Subscription):
    new_alloc = get_plan_minutes(subscription.plan)

    # ✅ free 플랜 → 무제한 minutes, 기간 무제한
    if subscription.plan == PlanType.free:
        new_usage = RecodingUsage(
            user_id=user_id,
            subscription_id=subscription.id,
            allocated_minutes=300,   # free는 1달 300분 → 기한 무제한이라도 이 규칙 유지
            used_minutes=0,
            period_start=date.today(),
            period_end=None,         # ✅ 기간 무제한
            created_at=datetime.now(UTC),
        )
        db.add(new_usage)
        db.commit()
        db.refresh(new_usage)
        return new_usage

    if new_alloc is None:  # enterprise (무제한)
        new_usage = RecodingUsage(
            user_id=user_id,
            subscription_id=subscription.id,
            allocated_minutes=None,  # ✅ 무제한 minutes
            used_minutes=0,
            period_start=date.today(),
            period_end=date.today() + timedelta(days=30),
            created_at=datetime.now(UTC),
        )
        db.add(new_usage)
        db.commit()
        db.refresh(new_usage)
        return new_usage

    # ✅ pro (30일 500분)
    prev_remaining = 0
    usage = (
        db.query(RecodingUsage)
        .filter(
            RecodingUsage.user_id == user_id,
            RecodingUsage.period_end >= date.today()
        )
        .order_by(RecodingUsage.period_end.desc())
        .first()
    )
    if usage and usage.allocated_minutes is not None:
        prev_remaining = max(usage.allocated_minutes - usage.used_minutes, 0)

    total_alloc = new_alloc + prev_remaining

    new_usage = RecodingUsage(
        user_id=user_id,
        subscription_id=subscription.id,
        allocated_minutes=total_alloc,
        used_minutes=0,
        period_start=date.today(),
        period_end=date.today() + timedelta(days=30),
        created_at=datetime.now(UTC),
    )
    db.add(new_usage)
    db.commit()
    db.refresh(new_usage)
    return new_usage
