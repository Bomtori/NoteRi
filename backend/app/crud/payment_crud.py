from typing import Optional, Tuple, List  # ✅ 확인
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy import func, text, asc, desc
from sqlalchemy.orm import Session
from backend.app.model import Payment, Subscription, Plan, PlanType
from backend.app.util.trend import trend_series
from backend.app.util.day_calculation import (
_today_local,_growth_rate,_month_bounds,_add_months,_year_bounds,_week_bounds
)
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

def get_my_payments(db: Session, *, user_id: int):
    q = (
        db.query(Payment)
        .join(Subscription, Subscription.id == Payment.subscription_id, isouter=True)
        .join(Plan, Plan.id == Subscription.plan_id, isouter=True)
        .filter(Payment.user_id == user_id)
        .order_by(Payment.approved_at.desc())
    )

    payments = q.all()

    # plan_name 관계 접근으로 주입
    for p in payments:
        p.plan_name = p.subscription.plan.name if p.subscription and p.subscription.plan else None

    return payments


def get_my_payment_detail(db: Session, user_id: int, payment_id: int):
    row = (
        db.query(Payment, Plan.name.label("plan_name"))
        .join(Subscription, Subscription.id == Payment.subscription_id, isouter=True)
        .join(Plan, Plan.id == Subscription.plan_id, isouter=True)
        .filter(Payment.user_id == user_id, Payment.id == payment_id)
        .first()
    )
    if not row:
        return None
    payment, plan_name = row
    setattr(payment, "plan_name", plan_name)
    return payment

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

def get_total_payment_amount(db: Session) -> float:
    """
    전체 기간 총 매출 (SUCCESS만).
    """
    total = db.query(func.coalesce(func.sum(Payment.amount), 0))\
              .filter(Payment.status == "SUCCESS")\
              .scalar() or Decimal("0")
    return float(total)


def _sum_total_amount(
    db: Session, *, start_date: Optional[date] = None, end_date: Optional[date] = None
) -> float:
    """
    기간 총 매출 (SUCCESS만). 날짜 구간은 [start_date, end_date) 반열린.
    """
    q = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.status == "SUCCESS")
    if start_date is not None:
        q = q.filter(func.date(Payment.approved_at) >= start_date)
    if end_date is not None:
        q = q.filter(func.date(Payment.approved_at) < end_date)
    total: Decimal = q.scalar() or Decimal("0")
    return float(total)

# ---- 이번 주 총매출 (월~오늘, 내일 0시 미만) ----
def get_this_week_total_revenue(db: Session) -> float:
    today = _today_local()
    week_start, _next_monday = _week_bounds(today)   # 이번 주 월요일
    end = today + timedelta(days=1)                  # 오늘 포함
    return _sum_total_amount(db, start_date=week_start, end_date=end)

# ---- 이번 달 총매출 (1일~오늘, 내일 0시 미만) ----
def get_this_month_total_revenue(db: Session) -> float:
    today = _today_local()
    month_start, _next_month = _month_bounds(today)
    end = today + timedelta(days=1)
    return _sum_total_amount(db, start_date=month_start, end_date=end)

# ---- 이번 년도 총매출 (YTD: 1/1~오늘, 내일 0시 미만) ----
def get_this_year_total_revenue(db: Session) -> float:
    today = _today_local()
    year_start, _next_year = _year_bounds(today)
    end = today + timedelta(days=1)
    return _sum_total_amount(db, start_date=year_start, end_date=end)