from pydantic import BaseModel, condecimal, constr, ConfigDict
from typing import Optional
from datetime import datetime

# 이름 규칙 (소문자/숫자/하이픈만)
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
    name: Optional[PlanCode] = None      # ✅ 이름도 수정 가능하도록 추가
    price: Optional[condecimal(max_digits=10, decimal_places=2)] = None
    duration_days: Optional[int] = None
    allocated_seconds: Optional[int] = None
    description: Optional[str] = None

class PlanPriceUpdate(BaseModel):
    price: condecimal(max_digits=10, decimal_places=2)

class PlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price: condecimal(max_digits=10, decimal_places=2)
    duration_days: int
    allocated_seconds: int
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
