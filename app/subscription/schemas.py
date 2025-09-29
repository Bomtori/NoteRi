from pydantic import BaseModel
from datetime import date
from app.model import PlanType
from typing import Optional


class SubscriptionUpdate(BaseModel):
    plan: Optional[PlanType] = None
    # start_date, end_date는 자동 갱신되므로 제외
    is_active: Optional[bool] = None

    model_config = {"from_attributes": True}

#
# class SubscriptionUpdate(BaseModel):
#     plan: Optional[PlanType] = None
#     start_date: Optional[date] = None
#     end_date: Optional[date] = None
#     is_active: Optional[bool] = None
#
#     model_config = {"from_attributes": True}


class SubscriptionResponse(BaseModel):
    id: int
    user_id: int
    plan: PlanType
    start_date: date
    end_date: date
    is_active: bool
    payment_info: Optional[dict] = None

    model_config = {"from_attributes": True}
