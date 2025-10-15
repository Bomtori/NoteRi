from typing import Optional, Tuple, List  # ✅ 확인
from datetime import date, timedelta
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from backend.app.model import Payment, Subscription, Plan, PlanType


def _bucket_range(g, start, end):
    if g=="day":
        return [start + timedelta(days=i) for i in range((end-start).days+1)]
    if g=="week":
        s = start - timedelta(days=start.weekday()); e = end - timedelta(days=end.weekday())
        k = ((e - s).days // 7) + 1
        return [s + timedelta(weeks=i) for i in range(k)]
    if g=="month":
        out=[]; y,m=start.year,start.month
        while (y,m) <= (end.year,end.month):
            out.append(date(y,m,1)); m=(m%12)+1; y += 1 if m==1 else 0
        return out
    if g=="year":
        return [date(y,1,1) for y in range(start.year, end.year+1)]
    raise ValueError

def _label(g, d):
    return d.isoformat() if g in ("day","week") else (f"{d.year:04d}-{d.month:02d}" if g=="month" else f"{d.year:04d}")

def _time_bucket(g, col):
    return func.date(col) if g=="day" else func.date_trunc(g, col)

def _range_for(g, today: date):
    if g=="day":
        return today, today
    if g=="week":
        w0 = today - timedelta(days=today.weekday())
        return w0 - timedelta(weeks=4), w0
    if g=="month":
        this = date(today.year, today.month, 1)
        y,m = this.year, this.month
        for _ in range(5):
            m = 12 if m==1 else m-1; y -= 1 if m==12 else 0
        return date(y,m,1), this
    if g=="year":
        return date(today.year-4,1,1), date(today.year,1,1)
    raise ValueError

def _trend_by_plan(db: Session, start: date, end: date, g: str):
    bucket = _time_bucket(g, Payment.approved_at)
    rows = (
        db.query(bucket.label("b"), Plan.name.label("p"), func.coalesce(func.sum(Payment.amount),0))
          .join(Subscription, Payment.subscription_id==Subscription.id, isouter=True)
          .join(Plan, Subscription.plan_id==Plan.id, isouter=True)
          .filter(Payment.status=="SUCCESS", Payment.approved_at!=None)
          .filter(func.date(Payment.approved_at)>=start, func.date(Payment.approved_at)<=end)
          .group_by("b","p").order_by("b").all()
    )
    agg={}
    for b,p,amt in rows:
        d = b.date() if hasattr(b,"date") else b  # date_trunc -> date
        key = p.value if isinstance(p, PlanType) else p
        agg.setdefault(d, {})[key]=float(amt)
    data=[]; tot_pro=tot_ent=0.0
    for d in _bucket_range(g, start, end):
        pro = agg.get(d, {}).get("pro", 0.0)
        ent = agg.get(d, {}).get("enterprise", 0.0)
        data.append({("date" if g=="day" else "week_start" if g=="week" else g): _label(g,d),
                     "pro": pro, "enterprise": ent})
        tot_pro += pro; tot_ent += ent
    return {"range":{"start":start.isoformat(),"end":end.isoformat()},
            "granularity": g, "totals":{"pro":tot_pro,"enterprise":tot_ent}, "data": data}

# ---- 공개 함수 (짧게) ----
def get_payment_today_by_plan(db: Session):
    t=date.today(); return _trend_by_plan(db, t, t, "day")

def get_payment_last_7_days_by_plan(db: Session):
    end=date.today(); start=end - timedelta(days=6); return _trend_by_plan(db, start, end, "day")

def get_payment_last_5_weeks_by_plan(db: Session):
    return _trend_by_plan(db, *_range_for("week", date.today()), "week")

def get_payment_last_6_months_by_plan(db: Session):
    return _trend_by_plan(db, *_range_for("month", date.today()), "month")

def get_payment_last_5_years_by_plan(db: Session):
    return _trend_by_plan(db, *_range_for("year", date.today()), "year")

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