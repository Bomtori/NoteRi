# plan_schema.py
from pydantic import BaseModel, condecimal, constr
from typing import Optional
from datetime import datetime

# name은 문자열로 받되, 소문자/숫자/하이픈만 허용 (필요 규칙에 맞게 조정)
PlanCode = constr(strip_whitespace=True, to_lower=True, pattern=r"^[a-z0-9-]{3,32}$")

class PlanBase(BaseModel):
    name: PlanCode
    price: condecimal(max_digits=10, decimal_places=2)
    duration_days: int
    allocated_seconds: int
    description: Optional[str] = None

class PlanCreate(PlanBase):
    pass

class PlanUpdate(BaseModel):
    price: Optional[condecimal(max_digits=10, decimal_places=2)] = None
    duration_days: Optional[int] = None
    allocated_seconds: Optional[int] = None
    description: Optional[str] = None

class PlanPriceUpdate(BaseModel):
    price: condecimal(max_digits=10, decimal_places=2)

class PlanRead(BaseModel):
    id: int
    name: str
    price: condecimal(max_digits=10, decimal_places=2)
    duration_days: int
    allocated_seconds: int
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
