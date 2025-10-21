# backend/app/util/metrics.py
from __future__ import annotations
from typing import Optional, Any, List, Dict, Callable
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, text

def sum_between(
    db: Session,
    *,
    table,           # SQLAlchemy model class
    amount_col,      # SA column (e.g., Payment.amount)
    date_col,        # SA column (e.g., Payment.approved_at)
    start_date: Optional[date] = None,  # [start, end)
    end_date: Optional[date] = None,
    where: Optional[Any] = None,
    joins: Optional[List[Any]] = None
) -> float:
    q = db.query(func.coalesce(func.sum(amount_col), 0.0))
    if joins:
        for j in joins:
            q = q.join(j, isouter=True)
    if where is not None:
        q = q.filter(where)
    if start_date is not None:
        q = q.filter(func.date(date_col) >= start_date)
    if end_date is not None:
        q = q.filter(func.date(date_col) < end_date)
    total: Decimal = q.scalar() or Decimal("0")
    return float(total)

def sum_by_category_between(
    db: Session,
    *,
    table,
    amount_col,
    date_col,
    category_col,                       # group by key (e.g., Plan.name)
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    where: Optional[Any] = None,
    joins: Optional[List[Any]] = None,
    ensure_keys: Optional[List[str]] = None,
) -> Dict[str, float]:
    agg_expr = func.coalesce(func.sum(amount_col), 0.0).label("total")
    cat_expr = category_col.label("cat")
    q = db.query(cat_expr, agg_expr)
    if joins:
        for j in joins:
            q = q.join(j, isouter=True)
    if where is not None:
        q = q.filter(where)
    if start_date is not None:
        q = q.filter(func.date(date_col) >= start_date)
    if end_date is not None:
        q = q.filter(func.date(date_col) < end_date)
    rows = q.group_by(cat_expr).all()
    out: Dict[str, float] = {}
    for cat, total in rows:
        key = getattr(cat, "value", str(cat))
        out[key] = float(total or 0.0)
    if ensure_keys:
        for k in ensure_keys:
            out.setdefault(k, 0.0)
    return out
