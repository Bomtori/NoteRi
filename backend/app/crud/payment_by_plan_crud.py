from __future__ import annotations
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from typing import Dict, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.app.util.day_calculation import (
    _today_local,
    _growth_rate,
    _month_bounds,
    _year_bounds,
)
from backend.app.model import Payment, Subscription, Plan, PlanType


def _sum_by_plan(
    db: Session,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,  # [start_date, end_date) 반열린 구간
) -> Dict[str, float]:
    q = (
        db.query(Plan.name.label("plan_name"), func.coalesce(func.sum(Payment.amount), 0))
        .join(Subscription, Payment.subscription_id == Subscription.id)
        .join(Plan, Subscription.plan_id == Plan.id)
        .filter(Payment.status == "SUCCESS")
    )
    if start_date is not None:
        q = q.filter(func.date(Payment.approved_at) >= start_date)
    if end_date is not None:
        q = q.filter(func.date(Payment.approved_at) < end_date)

    rows = q.group_by(Plan.name).all()

    out = {plan.value: float(total or Decimal("0")) for plan, total in rows}
    # 모든 플랜 키 보장
    for p in PlanType:
        out.setdefault(p.value, 0.0)
    return out

# ---------------- 1) 최근 일주일 총 매출 / 플랜별 ----------------
def get_last_7d_revenue_by_plan(db: Session) -> Dict[str, float]:
    """
    오늘 포함 최근 7일(오늘~6일 전)의 합계. [start, end) = [today-6, tomorrow)
    """
    today = _today_local()
    start = today - timedelta(days=6)
    end = today + timedelta(days=1)
    return _sum_by_plan(db, start_date=start, end_date=end)


# ---------------- 2) 최근 한 달 총 매출 / 플랜별 ----------------
def get_last_30d_revenue_by_plan(db: Session) -> Dict[str, float]:
    """
    오늘 포함 최근 30일(오늘~29일 전). [start, end) = [today-29, tomorrow)
    """
    today = _today_local()
    start = today - timedelta(days=29)
    end = today + timedelta(days=1)
    return _sum_by_plan(db, start_date=start, end_date=end)


# ---------------- 3) 최근 일년 총 매출 / 플랜별 ----------------
def get_last_365d_revenue_by_plan(db: Session) -> Dict[str, float]:
    """
    오늘 포함 최근 365일(오늘~364일 전). [start, end) = [today-364, tomorrow)
    """
    today = _today_local()
    start = today - timedelta(days=364)
    end = today + timedelta(days=1)
    return _sum_by_plan(db, start_date=start, end_date=end)


# ---------------- 4) 플랜별 전월 대비 성장률 ----------------
def get_mom_growth_by_plan(db: Session) -> Dict[str, dict]:
    """
    현재 달(1일~오늘 포함) vs 전월 같은 구간(전월 1일~전월 마지막일)의 매출 비교.
    반환: {"pro": {"current": 10000.0, "previous": 8000.0, "growth_rate": 0.25}, ...}
    """
    today = _today_local()

    # 현재달 구간: [이달 1일, 내일)
    cur_start, month_end = _month_bounds(today)
    cur_end = today + timedelta(days=1)  # 오늘 포함

    # 전월 구간: 전월 1일 ~ 전월 (today.day)일까지 (경계 안전)
    prev_anchor = cur_start - timedelta(days=1)  # 전월의 임의 날짜
    prev_m_start, prev_m_end = _month_bounds(prev_anchor)
    prev_end_day = min(today.day, (prev_m_end - timedelta(days=1)).day)
    prev_end = prev_m_start + timedelta(days=prev_end_day)  # 전월 today.day “다음날 0시”
    # 예: 전월 1일~전월 today.day (포함) → [prev_m_start, prev_end)

    cur = _sum_by_plan(db, start_date=cur_start, end_date=cur_end)
    prev = _sum_by_plan(db, start_date=prev_m_start, end_date=prev_end)

    out = {}
    for p in PlanType:
        c = cur.get(p.value, 0.0)
        pv = prev.get(p.value, 0.0)
        out[p.value] = {"current": c, "previous": pv, "growth_rate": _growth_rate(c, pv)}
    return out


# ---------------- 5) 플랜별 전년 대비 성장률 ----------------
def get_yoy_growth_by_plan(db: Session) -> Dict[str, dict]:
    """
    YTD(올해 1/1 ~ 오늘 포함) vs 전년 동기(작년 1/1 ~ 작년 오늘과 같은 월/일까지).
    반환: {"enterprise": {"current": ..., "previous": ..., "growth_rate": ...}, ...}
    """
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


# ---------------- 6) 플랜별 매출 비율 ----------------
def get_revenue_share_by_plan(
    db: Session,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Dict[str, float]:
    """
    기간 내 매출 비율(0~1). 기간을 지정하지 않으면 전체(SUCCESS 전부).
    """
    by_plan = _sum_by_plan(db, start_date=start_date, end_date=end_date)
    total = sum(by_plan.values())
    if total == 0:
        return {k: 0.0 for k in by_plan}
    return {k: v / total for k, v in by_plan.items()}

def get_total_revenue_paid_plans(
    db: Session,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Dict[str, float]:
    """
    유료 플랜(pro, enterprise)만 총 매출 집계.
    기간을 지정하지 않으면 전체(SUCCESS 전부).
    반환 예: {"pro": 155000.0, "enterprise": 420000.0}
    """
    by_plan = _sum_by_plan(db, start_date=start_date, end_date=end_date)
    # 유료 플랜만 추출 + 키 보장
    return {
        "pro": float(by_plan.get("pro", 0.0)),
        "enterprise": float(by_plan.get("enterprise", 0.0)),
    }