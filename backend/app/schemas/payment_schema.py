# schemas/payment_schema.py
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from decimal import Decimal

class PaymentItem(BaseModel):
    id: int
    order_id: str
    amount: Decimal              # Decimal 유지 권장(정확성). 프론트에서 숫자로 변환 가능.
    method: Optional[str] = None
    status: str
    transaction_key: Optional[str] = None
    approved_at: Optional[datetime] = None
    canceled_at: Optional[datetime] = None
    subscription_id: Optional[int] = None
    plan_name: Optional[str] = None

    model_config = {"from_attributes": True}

class PaymentListResponse(BaseModel):
    total: int
    items: List[PaymentItem]
    has_more: bool
    next_offset: Optional[int] = None
