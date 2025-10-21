from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.db import get_db
from backend.app.crud.mrr_crud import get_mrr_breakdown_monthly

router = APIRouter(prefix="/billing", tags=["billing"])

@router.get("/mrr/breakdown")
def read_mrr_breakdown(
    months: int = Query(6, ge=1, le=24),
    start: str | None = Query(None, description="시작 월(YYYY-MM). 없으면 최근 months 개를 현재월 기준으로 계산"),
    db: Session = Depends(get_db),
):
    today = date.today()
    if start:
        y, m = map(int, start.split("-"))
        start_month = date(y, m, 1)
    else:
        # 최근 months 개가 나오도록 시작월 산출
        start_month = date(today.year, today.month, 1)
        for _ in range(months - 1):
            if start_month.month == 1:
                start_month = start_month.replace(year=start_month.year - 1, month=12)
            else:
                start_month = start_month.replace(month=start_month.month - 1)

    return get_mrr_breakdown_monthly(db, start_month=start_month, months=months)
