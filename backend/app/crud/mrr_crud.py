from datetime import date, timedelta
from typing import Dict, Any, List
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.model import Subscription, Plan  # 모델 그대로 사용

def _eom(d: date) -> date:
    if d.month == 12:
        return date(d.year, 12, 31)
    first_next = date(d.year, d.month + 1, 1)
    return first_next - timedelta(days=1)

def _add_months(d: date, m: int) -> date:
    y = d.year + (d.month - 1 + m) // 12
    mm = (d.month - 1 + m) % 12 + 1
    return date(y, mm, 1)

def _month_seq(start_month: date, months: int) -> List[date]:
    return [_add_months(start_month, i) for i in range(months)]

def _to_float(x) -> float:
    if x is None:
        return 0.0
    if isinstance(x, Decimal):
        return float(x)
    return float(x)

def _price_to_mrr(price: Decimal, duration_days: int) -> float:
    p = _to_float(price)
    if not duration_days or duration_days == 30:
        return p
    return p * (30.0 / float(duration_days))

def _active_subs_at(db: Session, month_end: date):
    return (
        db.query(
            Subscription.user_id.label("user_id"),
            Plan.price.label("price"),
            Plan.duration_days.label("duration_days"),
        )
        .join(Plan, Plan.id == Subscription.plan_id)
        .filter(
            Subscription.is_active.is_(True),
            Subscription.start_date <= month_end,
            or_(Subscription.end_date.is_(None), Subscription.end_date > month_end),
        )
    )

def _mrr_by_user_at(db: Session, month_end: date) -> Dict[int, float]:
    rows = _active_subs_at(db, month_end).all()
    agg: Dict[int, float] = {}
    for r in rows:
        mrr = _price_to_mrr(r.price, r.duration_days or 30)
        agg[r.user_id] = agg.get(r.user_id, 0.0) + mrr
    return agg

def get_mrr_breakdown_monthly(db: Session, start_month: date, months: int = 6) -> Dict[str, Any]:

    months_list = _month_seq(start_month, months)
    series: List[Dict[str, Any]] = []

    prev_month_end = _eom(_add_months(months_list[0], -1))
    prev_by_user = _mrr_by_user_at(db, prev_month_end)
    prev_total = sum(prev_by_user.values())

    for m0 in months_list:
        month_end = _eom(m0)
        cur_by_user = _mrr_by_user_at(db, month_end)
        new = expansion = contraction = churn = 0.0
        all_uids = set(prev_by_user.keys()) | set(cur_by_user.keys())
        for uid in all_uids:
            prev = prev_by_user.get(uid, 0.0)
            cur = cur_by_user.get(uid, 0.0)
            if prev == 0.0 and cur > 0.0:
                new += cur
            elif prev > 0.0 and cur == 0.0:
                churn -= prev  # 음수
            elif prev > 0.0 and cur > 0.0:
                diff = cur - prev
                if diff > 0:
                    expansion += diff
                elif diff < 0:
                    contraction += diff  # 음수

        net_new = new + expansion + contraction + churn
        ending = prev_total + net_new

        series.append({
            "month": m0.strftime("%Y-%m"),
            "new": round(new, 2),
            "expansion": round(expansion, 2),
            "contraction": round(contraction, 2),
            "churn": round(churn, 2),
            "net_new": round(net_new, 2),
            "ending_mrr": round(ending, 2),
        })
        prev_by_user = cur_by_user
        prev_total = sum(cur_by_user.values())

    return {"series": series}
