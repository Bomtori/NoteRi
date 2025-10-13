from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from backend.app.model import PlanType  # enum

class PaymentItem(BaseModel):
    id: int
    order_id: str
    amount: Decimal
    method: Optional[str] = None
    status: str
    transaction_key: Optional[str] = None
    approved_at: Optional[datetime] = None
    canceled_at: Optional[datetime] = None
    plan_name: Optional[PlanType] = None  # pro / enterprise / free / None
    subscription_id: Optional[int] = None

    class Config:
        orm_mode = True

class PaymentListResponse(BaseModel):
    total: int
    items: list[PaymentItem]
