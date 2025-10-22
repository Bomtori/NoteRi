# backend/app/util/common_analytics.py
from __future__ import annotations
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, Union, Callable
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session, Query
from sqlalchemy import func, and_, ColumnElement

from backend.app.model import Payment, Subscription, Plan, PlanType

# ---------------------------
# 1) 범용 날짜 구간 집계 유틸
# ---------------------------

def sum_between_dates(
    db: Session,
    *,
    model,
    value_col: ColumnElement,
    ts_col: ColumnElement,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,   # [start, end)
    extra_filters: Optional[Sequence[ColumnElement]] = None,
) -> float:
    """
    테이블/컬럼을 직접 받아 [start, end) 구간의 합계를 안전하게 계산.
    """
    q = db.query(func.coalesce(func.sum(value_col), 0))
    if extra_filters:
        q = q.filter(and_(*extra_filters))
    if start_date is not None:
        q = q.filter(func.date(ts_col) >= start_date)
    if end_date is not None:
        q = q.filter(func.date(ts_col) < end_date)
    val: Decimal = q.scalar() or Decimal("0")
    return float(val)


def count_between_dates(
    db: Session,
    *,
    model,
    ts_col: ColumnElement,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,   # [start, end)
    extra_filters: Optional[Sequence[ColumnElement]] = None,
) -> int:
    """
    테이블/컬럼을 직접 받아 [start, end) 구간의 row 개수를 계산.
    """
    q = db.query(func.count())  # COUNT(*)
    if extra_filters:
        q = q.filter(and_(*extra_filters))
    if start_date is not None:
        q = q.filter(func.date(ts_col) >= start_date)
    if end_date is not None:
        q = q.filter(func.date(ts_col) < end_date)
    return int(q.scalar() or 0)


# ------------------------------------------------
# 2) Payments 전용: 공통 조인/필터 & 합계/시리즈 도우미
# ------------------------------------------------

def payment_base_filters() -> List[ColumnElement]:
    """
    payments 공통 where 절: SUCCESS & approved_at NOT NULL
    """
    return [Payment.status == "SUCCESS", Payment.approved_at.isnot(None)]


def payment_base_query(db: Session) -> Query:
    """
    payments p
      LEFT JOIN subscriptions s
      LEFT JOIN plans pl
    + SUCCESS only
    """
    q = (
        db.query(Payment)
          .outerjoin(Subscription, Payment.subscription_id == Subscription.id)
          .outerjoin(Plan, Subscription.plan_id == Plan.id)
          .filter(*payment_base_filters())
    )
    return q


def sum_payments_between(
    db: Session, *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    extra_filters: Optional[Sequence[ColumnElement]] = None,
) -> float:
    """
    Payments 전용 합계(SUCCESS만). 날짜 구간은 [start, end).
    """
    filters = list(payment_base_filters())
    if extra_filters:
        filters.extend(extra_filters)

    return sum_between_dates(
        db,
        model=Payment,
        value_col=Payment.amount,
        ts_col=Payment.approved_at,
        start_date=start_date,
        end_date=end_date,
        extra_filters=filters,
    )


def sum_payments_by_plan_between(
    db: Session, *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Dict[str, float]:
    """
    [start, end) 구간의 플랜별 매출 합계.
    누락 플랜은 0.0으로 채워서 반환.
    """
    q = (
        db.query(Plan.name.label("plan_name"), func.coalesce(func.sum(Payment.amount), 0).label("total"))
          .join(Subscription, Payment.subscription_id == Subscription.id)
          .join(Plan, Subscription.plan_id == Plan.id)
          .filter(*payment_base_filters())
    )
    if start_date is not None:
        q = q.filter(func.date(Payment.approved_at) >= start_date)
    if end_date is not None:
        q = q.filter(func.date(Payment.approved_at) < end_date)

    rows = q.group_by(Plan.name).all()
    out = { (p.value if hasattr(p, "value") else str(p)) : float(t or 0) for p, t in rows }
    return ensure_plan_keys(out)


# ---------------------------
# 3) 결과 변환/보정 유틸
# ---------------------------

def ensure_plan_keys(d: Dict[str, float]) -> Dict[str, float]:
    """
    free/pro/enterprise 키가 모두 존재하도록 보정.
    """
    out = dict(d)
    for p in PlanType:
        out.setdefault(p.value, 0.0)
    return out


def rows_to_xy(
    rows: Optional[Iterable[Any]],
    *,
    x_candidates: Sequence[str] = ("x", "label", "date", "week", "month", "year"),
    y_candidates: Sequence[str] = ("y", "count", "value", "total"),
    to_str_x: bool = True,
    to_int_y: bool = True,
) -> List[Dict[str, Union[str, int, float]]]:
    """
    다양한 형태의 row를 {x, y} 리스트로 정규화.
    - x_candidates 중 첫 번째로 존재하는 필드를 x로 사용
    - y_candidates 중 첫 번째로 존재하는 필드를 y로 사용
    """
    series: List[Dict[str, Union[str, int, float]]] = []
    for r in rows or []:
        x = None
        y = None
        for c in x_candidates:
            v = getattr(r, c, None)
            if v is not None:
                x = v
                break
        for c in y_candidates:
            v = getattr(r, c, None)
            if v is not None:
                y = v
                break
        if x is None:
            x = ""
        if y is None:
            y = 0
        if to_str_x:
            x = str(x)
        if to_int_y:
            try:
                y = int(y)
            except Exception:
                try:
                    y = float(y)
                except Exception:
                    y = 0
        series.append({"x": x, "y": y})
    return series


def attach_plan_name(payment: Payment) -> None:
    """
    Payment 객체에 계산 필드 plan_name을 붙여주는 헬퍼.
    """
    plan_name = None
    if payment.subscription and payment.subscription.plan:
        p = payment.subscription.plan.name
        plan_name = p.value if hasattr(p, "value") else str(p)
    setattr(payment, "plan_name", plan_name)


def paginate(
    q: Query,
    *,
    limit: int = 20,
    offset: int = 0,
    order_by: Optional[Union[ColumnElement, Sequence[ColumnElement]]] = None,
) -> Tuple[int, List[Any]]:
    """
    단순 페이지네이션 유틸: (total, items)
    """
    total = q.count()
    if order_by is not None:
        if isinstance(order_by, (list, tuple)):
            for ob in order_by:
                q = q.order_by(ob)
        else:
            q = q.order_by(order_by)
    items = q.limit(limit).offset(offset).all()
    return total, items
