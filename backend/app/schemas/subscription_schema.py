# backend/app/schemas/subscription_schema.py
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

class SubscriptionUpdate(BaseModel):
    plan_name: Optional[str] = None
    is_active: Optional[bool] = None
    model_config = {"from_attributes": True}

class SubscriptionResponse(BaseModel):
    id: int
    user_id: int
    plan_name: str
    start_date: date
    end_date: Optional[date]
    updated_at: Optional[datetime]   # ✅ datetime으로
    is_active: bool
    model_config = {"from_attributes": True}

class PlanUserCount(BaseModel):
    plan: str
    user_count: int