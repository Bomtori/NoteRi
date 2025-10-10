from sqlalchemy.orm import Session
from sqlalchemy import func, extract, text
from app.model import Subscription, Plan

def get_subscription_count_by_plan(db: Session):
    result = (
        db.query(Plan.name, func.count(Plan.id))
        .group_by(Plan.name)
        .all()
    )

    return {plan_name or "none" for plan_name, count in result}