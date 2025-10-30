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
    # Enum이면 .value, 아니면 str(plan)
    return getattr(plan, "value", str(plan)) or ""

def _sum_by_plan(db, start_date=None, end_date=None) -> dict[str, float]:
    """
    결제 성공(SUCCESS)만 Plan.name 기준으로 합산해서 dict로 반환.
    { "<plan_name>": <total_amount_float>, ... }
    """
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
    # rows: [("pro", 680000.0), ("enterprise", 300000.0), ...]
    out = {}
    for plan_name, total in rows:
        key = _plan_key(plan_name)  # 문자열이면 그대로, Enum이면 .value
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
    """
    응답: {"items": [{"plan_id": <int or None>, "plan_name": <str>, "total_amount": <float>}, ...]}
    ※ plan_id가 꼭 필요 없으면 None으로 두거나, 별도 쿼리로 매핑
    """
    by_plan = _sum_by_plan(db, start_date=start_date, end_date=end_date)
    if not by_plan:
        by_plan = _sum_by_plan_fallback(db, start_date=start_date, end_date=end_date)

    # plan_id도 내려보내고 싶으면 이 쿼리로 매핑 테이블 확보
    plan_rows = db.query(Plan.id, Plan.name).all()
    name_to_id = {str(name): pid for pid, name in plan_rows}

    items = [
        {
            "plan_id": name_to_id.get(str(name)),  # 없으면 None
            "plan_name": str(name),
            "total_amount": float(amount or 0.0),
        }
        for name, amount in by_plan.items()
    ]
    # 정렬(옵션)
    items.sort(key=lambda x: (x["plan_id"] is None, x["plan_id"] if x["plan_id"] is not None else 1e9))
    return {"items": items}

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


# ───────────── 전일 대비 (DoD) ─────────────
def get_dod_growth_by_plan(db) -> Dict[str, dict]:
    """
    오늘(00:00~내일 00:00) vs 어제(00:00~오늘 00:00).
    반환: {"pro": {"current": ..., "previous": ..., "growth_rate": ...}, ...}
    """
    today = _today_local()                 # date(로컬)
    cur_start = today                      # 오늘 00:00
    cur_end   = today + timedelta(days=1)  # 내일 00:00 (배타)

    prev_start = today - timedelta(days=1) # 어제 00:00
    prev_end   = today                     # 오늘 00:00

    cur  = _sum_by_plan(db, start_date=cur_start,  end_date=cur_end)
    prev = _sum_by_plan(db, start_date=prev_start, end_date=prev_end)

    out = {}
    for p in PlanType:
        c  = float(cur.get(p.value, 0.0))
        pv = float(prev.get(p.value, 0.0))
        out[p.value] = {"current": c, "previous": pv, "growth_rate": _growth_rate(c, pv)}
    return out


# ───────────── 전주 대비 (WoW: 주간누적 동요일까지) ─────────────
def get_wow_growth_by_plan(db) -> Dict[str, dict]:
    """
    이번 주 누적(월요일 00:00 ~ 오늘 포함) vs 지난주 '동요일'까지 누적.
    - 이번 주의 시작: 월요일 00:00 (ISO 주)
    - 지난 주 비교 구간: (이번 주 시작 - 7일) ~ (그 + (오늘-이번주시작) + 1일)
    반환: {"enterprise": {"current": ..., "previous": ..., "growth_rate": ...}, ...}
    """
    today = _today_local()                     # date
    # 이번 주 시작(월요일 00:00)
    cur_w_start = today - timedelta(days=today.weekday())
    cur_end     = today + timedelta(days=1)    # 오늘 포함 (내일 00:00)

    # 지난 주 시작 및 '동요일'까지 동일 길이 구간
    prev_w_start = cur_w_start - timedelta(days=7)
    elapsed_days = (today - cur_w_start).days  # 이번주 경과 일수(월:0, 화:1, ...)
    prev_end     = prev_w_start + timedelta(days=elapsed_days + 1)  # 배타 상한

    cur  = _sum_by_plan(db, start_date=cur_w_start, end_date=cur_end)
    prev = _sum_by_plan(db, start_date=prev_w_start, end_date=prev_end)

    out = {}
    for p in PlanType:
        c  = float(cur.get(p.value, 0.0))
        pv = float(prev.get(p.value, 0.0))
        out[p.value] = {"current": c, "previous": pv, "growth_rate": _growth_rate(c, pv)}
    return out
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

def _base_range_filter(q, start_date: Optional[date], end_date: Optional[date]):
    # 기간 필터를 approved_at 기준으로 적용 (start<=approved_at<end+1day 식으로 쓰고 싶다면 조정)
    if start_date:
        q = q.filter(Payment.approved_at >= start_date)
    if end_date:
        # inclusive 로 하고 싶으면 <= end_date + 1day - epsilon 로 바꾸거나, approved_at::date <= end_date 로 캐스팅
        q = q.filter(Payment.approved_at <= end_date)
    return q

def get_total_revenue_by_plan(db: Session, start_date: Optional[date]=None, end_date: Optional[date]=None) -> List[Dict[str, Any]]:
    """
    결제 성공분을 Plan 기준으로 합산.
    응답: [{plan_id, plan_name, total_amount}]
    """
    # 경로 1: payment.subscription_id 로 직접 매핑
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

    # 경로 2: subscription_id 없을 때 user_id + 결제시각으로 유효 구독 매칭
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