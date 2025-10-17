from typing import Optional, Tuple, List  # ✅ 확인
from datetime import date, timedelta
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from backend.app.model import Payment, Subscription, Plan, PlanType
from backend.app.util.trend import trend_series

# 공통 where / joins
JOINS = """
LEFT JOIN subscriptions s ON p.subscription_id = s.id
LEFT JOIN plans pl ON s.plan_id = pl.id
"""
WHERE = "p.status = 'SUCCESS' AND p.approved_at IS NOT NULL"

def get_payment_today_by_plan(db: Session):
    t = date.today()
    return trend_series(
        db, table="payments p", ts_column="approved_at",
        start=t, end=t, granularity="day",
        agg="sum", agg_expr="p.amount",
        category_expr="pl.name",
        joins=JOINS, where=WHERE
    )

def get_payment_last_7_days_by_plan(db: Session):
    end = date.today()
    start = end - timedelta(days=6)
    return trend_series(
        db, table="payments p", ts_column="approved_at",
        start=start, end=end, granularity="day",
        agg="sum", agg_expr="p.amount",
        category_expr="pl.name",
        joins=JOINS, where=WHERE
    )

def get_payment_last_5_weeks_by_plan(db: Session):
    today = date.today()
    this_week_start = today - timedelta(days=today.weekday())
    start = this_week_start - timedelta(weeks=4)
    end = this_week_start
    return trend_series(
        db, table="payments p", ts_column="approved_at",
        start=start, end=end, granularity="week",
        agg="sum", agg_expr="p.amount",
        category_expr="pl.name",
        joins=JOINS, where=WHERE
    )

def get_payment_last_6_months_by_plan(db: Session):
    today = date.today()
    this_month_start = date(today.year, today.month, 1)
    y, m = this_month_start.year, this_month_start.month
    for _ in range(5):
        m = 12 if m == 1 else m - 1
        if m == 12: y -= 1
    start = date(y, m, 1)
    end = this_month_start
    return trend_series(
        db, table="payments p", ts_column="approved_at",
        start=start, end=end, granularity="month",
        agg="sum", agg_expr="p.amount",
        category_expr="pl.name",
        joins=JOINS, where=WHERE
    )

def get_payment_last_5_years_by_plan(db: Session):
    today = date.today()
    this_year_start = date(today.year, 1, 1)
    start = date(today.year - 4, 1, 1)
    end = this_year_start
    return trend_series(
        db, table="payments p", ts_column="approved_at",
        start=start, end=end, granularity="year",
        agg="sum", agg_expr="p.amount",
        category_expr="pl.name",
        joins=JOINS, where=WHERE
    )

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

# 플랜별 총 매출

def get_total_revenue_by_plan(db: Session):
    results = (
        db.query(Plan.name.label("plan_name"), func.sum(Payment.amount).label("total_revenue"))
        .join(Subscription, Payment.subscription_id == Subscription.id)
        .join(Plan, Subscription.plan_id == Plan.id)
        .filter(Payment.status == "SUCCESS")
        .group_by(Plan.name)
        .all()
    )

    revenue_dict = {plan.value: float(total or 0) for plan, total in results}

    for plan in PlanType:
        revenue_dict.setdefault(plan.value, 0.0)

    return revenue_dict