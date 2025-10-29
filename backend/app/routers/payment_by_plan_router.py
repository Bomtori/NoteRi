from fastapi import APIRouter, Depends, Query
from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.app.db import get_db
from backend.app.crud.payment_by_plan_crud import (
    get_last_7d_revenue_by_plan,
    get_last_30d_revenue_by_plan,
    get_last_365d_revenue_by_plan,
    get_mom_growth_by_plan,
    get_yoy_growth_by_plan,
    get_revenue_share_by_plan,
    get_total_revenue_by_plan, get_wow_growth_by_plan, get_dod_growth_by_plan
)
class RevenueByPlanItem(BaseModel):
    plan_id: int
    plan_name: str
    total_amount: float

class RevenueByPlanResponse(BaseModel):
    items: list[RevenueByPlanItem]

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# 플랜 별 7일간 매출 총합
@router.get("/revenue/last-7d")
def revenue_last_7d(db: Session = Depends(get_db)):
    return get_last_7d_revenue_by_plan(db)

# 플랜 별 30일간 매출 총합
@router.get("/revenue/last-30d")
def revenue_last_30d(db: Session = Depends(get_db)):
    return get_last_30d_revenue_by_plan(db)

# 플랜 별 365일간 매출 총합
@router.get("/revenue/last-365d")
def revenue_last_365d(db: Session = Depends(get_db)):
    return get_last_365d_revenue_by_plan(db)

@router.get("/revenue/dod")
def revenue_dod(db: Session = Depends(get_db)):
    return get_dod_growth_by_plan(db)

@router.get("/revenue/wow")
def revenue_wow(db: Session = Depends(get_db)):
    return get_wow_growth_by_plan(db)

# 플랜 별 전월 대비 성장률
@router.get("/revenue/mom")
def revenue_mom(db: Session = Depends(get_db)):
    return get_mom_growth_by_plan(db)

# 플랜 별 전년 대비 성장률
@router.get("/revenue/yoy")
def revenue_yoy(db: Session = Depends(get_db)):
    return get_yoy_growth_by_plan(db)

# 플랜 별 매출 비율
@router.get("/revenue/share")
def revenue_share(
    db: Session = Depends(get_db),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    """
    플랜별 매출 비율(0~1).
    - start_date / end_date(미지정 시 전체)
    - 날짜 구간은 [start_date, end_date] 반열린 구간
    """
    return get_revenue_share_by_plan(db, start_date=start_date, end_date=end_date)

@router.get("/revenue/paid", response_model=RevenueByPlanResponse)
def read_revenue_paid_plans(
    db: Session = Depends(get_db),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    rows = get_total_revenue_by_plan(db, start_date, end_date)
    return {"items": rows}

