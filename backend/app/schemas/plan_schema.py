# backend/app/schemas/plan_schema.py
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, condecimal
from datetime import datetime
from backend.app.model import PlanType  # 이미 Enum 이 있다고 가정

class PlanBase(BaseModel):
    name: PlanType
    price: condecimal(max_digits=10, decimal_places=2)  # Decimal 안전
    duration_days: int
    allocated_minutes: int
    description: Optional[str] = None

class PlanCreate(PlanBase):
    pass

class PlanUpdate(BaseModel):
    # 일반 업데이트용(필요시)
    price: Optional[condecimal(max_digits=10, decimal_places=2)] = None
    duration_days: Optional[int] = None
    allocated_minutes: Optional[int] = None
    description: Optional[str] = None

class PlanPriceUpdate(BaseModel):
    price: condecimal(max_digits=10, decimal_places=2)

class PlanRead(BaseModel):
    id: int
    name: PlanType
    price: Decimal
    duration_days: int
    allocated_minutes: int
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # SQLAlchemy 객체 -> Pydantic 변환
