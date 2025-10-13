from typing import Optional, Tuple, List  # ✅ 확인
from datetime import date
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.app.model import Payment, Subscription, Plan

def get_my_payments(
    db: Session,
    user_id: int,
    *,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = "SUCCESS",
    limit: int = 20,
    offset: int = 0,
) -> Tuple[int, List[Payment]]:   # ✅ (int, list[Payment])
    q = (
        db.query(Payment)
        .outerjoin(Subscription, Payment.subscription_id == Subscription.id)
        .outerjoin(Plan, Subscription.plan_id == Plan.id)
        .filter(Payment.user_id == user_id)
    )
    if status:
        q = q.filter(Payment.status == status)
    if date_from:
        q = q.filter(func.date(Payment.approved_at) >= date_from)
    if date_to:
        q = q.filter(func.date(Payment.approved_at) <= date_to)

    total = q.count()

    items = (
        q.order_by(Payment.approved_at.desc().nullslast(), Payment.created_at.desc())
         .limit(limit)
         .offset(offset)
         .all()
    )
    for p in items:
        p.plan_name = p.subscription.plan.name if (p.subscription and p.subscription.plan) else None
    return total, items


def get_my_payment_detail(
    db: Session, user_id: int, payment_id: int
) -> Optional[Payment]:          # ✅ Payment | None
    p = (
        db.query(Payment)
        .outerjoin(Subscription, Payment.subscription_id == Subscription.id)
        .outerjoin(Plan, Subscription.plan_id == Plan.id)
        .filter(Payment.user_id == user_id, Payment.id == payment_id)
        .first()
    )
    if p:
        p.plan_name = p.subscription.plan.name if (p.subscription and p.subscription.plan) else None
    return p
