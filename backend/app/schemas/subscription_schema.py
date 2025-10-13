from pydantic import BaseModel
from datetime import date
from typing import Optional
from datetime import date

class SubscriptionUpdate(BaseModel):
    plan_name: Optional[str] = None   # PlanType → 문자열 기반
    is_active: Optional[bool] = None

    model_config = {"from_attributes": True}


class SubscriptionResponse(BaseModel):
    id: int
    user_id: int
    plan_name: str                   # plan_id 대신 이름 반환
    start_date: date
    end_date: Optional[date]
    is_active: bool

    model_config = {"from_attributes": True}
