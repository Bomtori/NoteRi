from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date

class AdminUserPayment(BaseModel):
    id: int
    amount: float
    status: Optional[str] = None
    method: Optional[str] = None
    order_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    plan_name: Optional[str] = None
    
class AdminUserOverview(BaseModel):
    user_id: int
    name: Optional[str] = None
    email: Optional[str] = None
    is_banned: bool
    banned_reason: Optional[str] = None
    banned_until: Optional[datetime] = None
    is_active: bool  # 사용자 활성화 상태 (users.is_active)
    plan_name: Optional[str] = None              # 현재(또는 가장 최근) 구독 플랜명
    subscription_is_active: Optional[bool] = None  # ✅ Subscription의 is_active로 대체
    latest_payment_status: Optional[str] = None  # 가장 최근 결제 상태
    total_paid_amount: float                     # 지금까지 총 결제액 (SUCCESS 합계)
    next_billing_date: Optional[date] = None     # 다음 결제일(= 활성 구독 end_date 가정)
    joined_at: datetime                          # 가입일(created_at)
    payments: List[AdminUserPayment] = []

    model_config = {"from_attributes": True}  # Pydantic v2
    # (v1을 쓰신다면 대신 class Config: orm_mode = True 를 사용하세요)

class AdminUserOverviewListResponse(BaseModel):
    total: int
    items: List[AdminUserOverview]