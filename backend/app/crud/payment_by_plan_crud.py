from __future__ import annotations
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from typing import Dict, Optional, Tuple
from pydantic import BaseModel

from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from backend.app.util.day_calculation import (
    _today_local,
    _growth_rate,
    _month_bounds,
    _year_bounds,
)
from backend.app.model import Payment, Subscription, Plan, PlanType

def _plan_key(plan) -> str:

    return getattr(plan, "value", str(plan)) or ""

def _sum_by_plan(db, start_date=None, end_date=None) -> dict[str, float]:
    q = (
        db.query(
            Plan.name.label("plan_name"),
            func.coalesce(func.sum(Payment.amount), 0.0).label("total_amount"),
        )
        .join(Subscription, Subscription.id == Payment.subscription_id)
        .join(Plan, Plan.id == Subscription.plan_id)
        .filter(Payment.status == "SUCCESS")
    )
    q = _base_range_filter(q, start_date, end_date)
    q = q.group_by(Plan.name)

    rows = q.all()
    out = {}
    for plan_name, total in rows:
        key = _plan_key(plan_name)
        out[key] = float(total or 0.0)
    return out

def _sum_by_plan_fallback(db, start_date=None, end_date=None) -> dict[str, float]:
    q = (
        db.query(
            Plan.name.label("plan_name"),
            func.coalesce(func.sum(Payment.amount), 0.0).label("total_amount"),
        )
        .join(
            Subscription,
            and_(
                Subscription.user_id == Payment.user_id,
                Subscription.start_date <= Payment.approved_at,
                (Subscription.end_date == None) | (Payment.approved_at < Subscription.end_date),
            ),
        )
        .join(Plan, Plan.id == Subscription.plan_id)
        .filter(Payment.status == "SUCCESS")
    )
    q = _base_range_filter(q, start_date, end_date)
    q = q.group_by(Plan.name)

    rows = q.all()
    out = {}
    for plan_name, total in rows:
        key = _plan_key(plan_name)
        out[key] = float(total or 0.0)
    return out

def get_total_revenue_paid_plans(db, start_date=None, end_date=None):
    by_plan = _sum_by_plan(db, start_date=start_date, end_date=end_date)
    if not by_plan:
        by_plan = _sum_by_plan_fallback(db, start_date=start_date, end_date=end_date)
    plan_rows = db.query(Plan.id, Plan.name).all()
    name_to_id = {str(name): pid for pid, name in plan_rows}

    items = [
        {
            "plan_id": name_to_id.get(str(name)),
            "plan_name": str(name),
            "total_amount": float(amount or 0.0),
        }
        for name, amount in by_plan.items()
    ]

    items.sort(key=lambda x: (x["plan_id"] is None, x["plan_id"] if x["plan_id"] is not None else 1e9))
    return {"items": items}

def get_last_7d_revenue_by_plan(db: Session) -> Dict[str, float]:

    today = _today_local()
    start = today - timedelta(days=6)
    end = today + timedelta(days=1)
    return _sum_by_plan(db, start_date=start, end_date=end)

def get_last_30d_revenue_by_plan(db: Session) -> Dict[str, float]:

    today = _today_local()
    start = today - timedelta(days=29)
    end = today + timedelta(days=1)
    return _sum_by_plan(db, start_date=start, end_date=end)


def get_last_365d_revenue_by_plan(db: Session) -> Dict[str, float]:
    today = _today_local()
    start = today - timedelta(days=364)
    end = today + timedelta(days=1)
    return _sum_by_plan(db, start_date=start, end_date=end)

def get_dod_growth_by_plan(db) -> Dict[str, dict]:

    today = _today_local()                
    cur_start = today                      
    cur_end   = today + timedelta(days=1)  

    prev_start = today - timedelta(days=1) 
    prev_end   = today                     

    cur  = _sum_by_plan(db, start_date=cur_start,  end_date=cur_end)
    prev = _sum_by_plan(db, start_date=prev_start, end_date=prev_end)

    out = {}
    for p in PlanType:
        c  = float(cur.get(p.value, 0.0))
        pv = float(prev.get(p.value, 0.0))
        out[p.value] = {"current": c, "previous": pv, "growth_rate": _growth_rate(c, pv)}
    return out

def get_wow_growth_by_plan(db) -> Dict[str, dict]:

    today = _today_local()             
    cur_w_start = today - timedelta(days=today.weekday())
    cur_end     = today + timedelta(days=1)    

    prev_w_start = cur_w_start - timedelta(days=7)
    elapsed_days = (today - cur_w_start).days  
    prev_end     = prev_w_start + timedelta(days=elapsed_days + 1) 

    cur  = _sum_by_plan(db, start_date=cur_w_start, end_date=cur_end)
    prev = _sum_by_plan(db, start_date=prev_w_start, end_date=prev_end)

    out = {}
    for p in PlanType:
        c  = float(cur.get(p.value, 0.0))
        pv = float(prev.get(p.value, 0.0))
        out[p.value] = {"current": c, "previous": pv, "growth_rate": _growth_rate(c, pv)}
    return out
def get_mom_growth_by_plan(db: Session) -> Dict[str, dict]:

    today = _today_local()

    cur_start, month_end = _month_bounds(today)
    cur_end = today + timedelta(days=1) 

    prev_anchor = cur_start - timedelta(days=1)  
    prev_m_start, prev_m_end = _month_bounds(prev_anchor)
    prev_end_day = min(today.day, (prev_m_end - timedelta(days=1)).day)
    prev_end = prev_m_start + timedelta(days=prev_end_day) 

    cur = _sum_by_plan(db, start_date=cur_start, end_date=cur_end)
    prev = _sum_by_plan(db, start_date=prev_m_start, end_date=prev_end)

    out = {}
    for p in PlanType:
        c = cur.get(p.value, 0.0)
        pv = prev.get(p.value, 0.0)
        out[p.value] = {"current": c, "previous": pv, "growth_rate": _growth_rate(c, pv)}
    return out

def get_yoy_growth_by_plan(db: Session) -> Dict[str, dict]:
    today = _today_local()
    cur_y_start, _cur_y_end = _year_bounds(today)
    cur_end = today + timedelta(days=1)

    last_year = date(today.year - 1, today.month, min(today.day, 28))
    prev_y_start, prev_y_end = _year_bounds(last_year)
    prev_end = prev_y_start + (today - cur_y_start) + timedelta(days=1)
    # 전년 동기 길이를 현재 YTD와 동일하게 맞춤

    cur = _sum_by_plan(db, start_date=cur_y_start, end_date=cur_end)
    prev = _sum_by_plan(db, start_date=prev_y_start, end_date=prev_end)

    out = {}
    for p in PlanType:
        c = cur.get(p.value, 0.0)
        pv = prev.get(p.value, 0.0)
        out[p.value] = {"current": c, "previous": pv, "growth_rate": _growth_rate(c, pv)}
    return out

def get_revenue_share_by_plan(
    db: Session,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Dict[str, float]:

    by_plan = _sum_by_plan(db, start_date=start_date, end_date=end_date)
    total = sum(by_plan.values())
    if total == 0:
        return {k: 0.0 for k in by_plan}
    return {k: v / total for k, v in by_plan.items()}

def _base_range_filter(q, start_date: Optional[date], end_date: Optional[date]):
    if start_date:
        q = q.filter(Payment.approved_at >= start_date)
    if end_date:
        q = q.filter(Payment.approved_at <= end_date)
    return q

def get_total_revenue_by_plan(db: Session, start_date: Optional[date]=None, end_date: Optional[date]=None) -> List[Dict[str, Any]]:
    q = (
        db.query(
            Plan.id.label("plan_id"),
            Plan.name.label("plan_name"),
            func.coalesce(func.sum(Payment.amount), 0.0).label("total_amount"),
        )
        .join(Subscription, Subscription.id == Payment.subscription_id)
        .join(Plan, Plan.id == Subscription.plan_id)
        .filter(Payment.status == "SUCCESS")
    )
    q = _base_range_filter(q, start_date, end_date)
    q = q.group_by(Plan.id, Plan.name).order_by(Plan.id.asc())

    rows = [dict(r._mapping) for r in q.all()]
    if rows:
        return rows
    q2 = (
        db.query(
            Plan.id.label("plan_id"),
            Plan.name.label("plan_name"),
            func.coalesce(func.sum(Payment.amount), 0.0).label("total_amount"),
        )
        .join(
            Subscription,
            and_(
                Subscription.user_id == Payment.user_id,
                Subscription.start_date <= Payment.approved_at,
                (Subscription.end_date == None) | (Payment.approved_at < Subscription.end_date),
            ),
        )
        .join(Plan, Plan.id == Subscription.plan_id)
        .filter(Payment.status == "SUCCESS")
    )
    q2 = _base_range_filter(q2, start_date, end_date)
    q2 = q2.group_by(Plan.id, Plan.name).order_by(Plan.id.asc())
    return [dict(r._mapping) for r in q2.all()]