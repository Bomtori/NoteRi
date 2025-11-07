from typing import List, Tuple, Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from backend.app.model import Plan, Subscription

def _coerce_plan_name(x) -> str:
    return str(getattr(x, "value", x) or "none")

def get_subscription_count_by_plan(
    db: Session,
    *,
    as_of: Optional[date] = None,
    active_only: bool = True,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[Tuple[str, int]]:
   
    q = (
        db.query(
            Plan.name.label("plan_enum"),
            func.count(func.distinct(Subscription.user_id)).label("user_count"),
        )
        .outerjoin(Subscription, Subscription.plan_id == Plan.id)
    )

    conditions = []

    if as_of is not None:
        conditions.append(Subscription.start_date <= as_of)
        conditions.append(
            or_(Subscription.end_date == None, Subscription.end_date >= as_of)  
        )

    if active_only:
        conditions.append(Subscription.is_active == True)  

    if date_from is not None:
        conditions.append(Subscription.start_date >= date_from)
    if date_to is not None:
        conditions.append(Subscription.start_date <= date_to)

    if conditions:
        q = q.filter(and_(*conditions))

    q = q.group_by(Plan.id, Plan.name).order_by(Plan.id)

    rows = q.all()

    result: List[Tuple[str, int]] = []
    for plan_enum, cnt in rows:
        if hasattr(plan_enum, "value"):
            result.append((plan_enum.value, cnt))
        else:
            result.append((str(plan_enum), cnt))

    return result

