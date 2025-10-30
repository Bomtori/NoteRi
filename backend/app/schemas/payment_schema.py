# schemas/payment_schema.py
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from decimal import Decimal

class PaymentItem(BaseModel):
    id: int
    order_id: str
    amount: Decimal
    method: Optional[str]
    status: str
    transaction_key: Optional[str]
    approved_at: Optional[datetime]
    canceled_at: Optional[datetime]
    subscription_id: Optional[int]
    plan_name: Optional[str]
    model_config = {"from_attributes": True}
    
class PaymentListResponse(BaseModel):
    total: int
    items: List[PaymentItem]
    has_more: bool
    next_offset: Optional[int] = None
