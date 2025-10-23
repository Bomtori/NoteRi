# routers/payment_router.py
import logging
import os
import uuid
from typing import Optional

import httpx
import base64
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.deps.auth import get_current_user
from backend.app.model import User
from backend.app.db import get_db
from backend.app.model import Subscription, PlanType, Plan, Payment
from backend.app.schemas.payment_schema import PaymentListResponse, PaymentItem
from datetime import date, timedelta
from backend.app.crud import recording_usage_crud
from backend.app.crud.payment_crud import (
    get_payment_today_by_plan,
    get_payment_last_7_days_by_plan,
    get_payment_last_5_weeks_by_plan,
    get_payment_last_6_months_by_plan,
    get_payment_last_5_years_by_plan,
    get_my_payments,
    get_my_payment_detail, get_total_revenue_by_plan, get_total_payment_amount
, get_this_week_total_revenue,
    get_this_month_total_revenue,
    get_this_year_total_revenue, _sum_total_amount,
)
from backend.app.util.day_calculation import _today_local


class PaymentRequest(BaseModel):
    plan: PlanType

router = APIRouter(prefix="/payments", tags=["payments"])

# 환경 변수
TOSS_SECRET_KEY = os.getenv("TOSS_SECRET_KEY")
SUCCESS_URL = os.getenv("PAYMENT_SUCCESS_URL")
FAIL_URL = os.getenv("PAYMENT_FAIL_URL")


# ✅ 요청용 Pydantic 모델
class PaymentRequest(BaseModel):
    plan_name: str  # 예: "pro", "enterprise"


class PaymentConfirmRequest(BaseModel):
    paymentKey: str
    orderId: str
    amount: int
    plan_name: str  # 동일하게 plan_name


# ✅ 1️⃣ 결제 요청 API (프론트 → 토스 결제창으로 이동하기 전에 호출)
@router.post("/request")
def request_payment(
    req: PaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    plan = db.query(Plan).filter(Plan.name == req.plan_name).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Invalid plan selected")

    order_id = str(uuid.uuid4())
    amount = float(plan.price)

    return {
        "orderId": order_id,
        "amount": amount,
        "orderName": f"{plan.name} plan subscription",
        "customerEmail": current_user.email,
        "successUrl": f"{SUCCESS_URL}?plan={plan.name}",
        "failUrl": FAIL_URL,
    }



# ✅ 2️⃣ 결제 승인 API (토스 결제 완료 후 호출)
@router.post("/confirm")
async def confirm_payment(
    req: PaymentConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ----- ① 토스 결제 승인 -----
    url = "https://api.tosspayments.com/v1/payments/confirm"

    encoded_secret = base64.b64encode(f"{TOSS_SECRET_KEY}:".encode()).decode()
    headers = {"Authorization": f"Basic {encoded_secret}", "Content-Type": "application/json"}
    data = {"paymentKey": req.paymentKey, "orderId": req.orderId, "amount": req.amount}

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json())

    payment_result = response.json()

    # ----- (옵션) 멱등성: 같은 orderId로 이미 성공 기록이 있다면 바로 응답 -----
    already = (
        db.query(Payment)
        .filter(Payment.order_id == req.orderId, Payment.status.in_(["SUCCESS", "DONE"]))
        .first()
    )
    if already:
        sub = (
            db.query(Subscription)
            .filter(Subscription.user_id == current_user.id)
            .first()
        )
        plan = db.query(Plan).filter(Plan.id == sub.plan_id).first() if sub else None
        return {
            "message": "Payment already processed",
            "subscription": {
                "subscription_id": sub.id if sub else None,
                "plan_name": plan.name if plan else None,
                "start_date": str(sub.start_date) if sub else None,
                "end_date": str(sub.end_date) if sub else None,
                "is_active": sub.is_active if sub else None,
            },
            "payment": {
                "payment_id": already.id,
                "order_id": already.order_id,
                "amount": float(already.amount),
                "status": already.status,
            },
        }

    # ----- ② 플랜 조회 -----
    plan = db.query(Plan).filter(Plan.name == req.plan_name).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Invalid plan")

    # ----- ③ 구독 '수정' (없으면 생성) -----
    sub = (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.id)
        .first()
    )

    today = date.today()
    new_end = today + timedelta(days=plan.duration_days)

    if sub:
        # ✅ 기존 구독 업데이트
        sub.plan_id = plan.id
        sub.start_date = today
        sub.end_date = new_end
        sub.is_active = True  # 결제 성공 시 자동갱신/활성화 정책에 맞게 조정
        # (auto_renew / next_renew_on 같은 컬럼을 쓰신다면 여기서 함께 갱신)
        db.commit()
        db.refresh(sub)
    else:
        # ✅ 첫 결제인 경우만 새로 생성 (안전 upsert)
        sub = Subscription(
            user_id=current_user.id,
            plan_id=plan.id,
            start_date=today,
            end_date=new_end,
            is_active=True,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

    # ----- ④ 녹음 사용량 초기화/갱신 -----
    recording_usage_crud.create_or_update_usage(db, current_user.id, sub)

    # ----- ⑤ 결제 내역 기록 -----
    new_payment = Payment(
        user_id=current_user.id,
        subscription_id=sub.id,
        order_id=req.orderId,
        amount=req.amount,
        method=payment_result.get("method", ""),
        status=payment_result.get("status", "") or "SUCCESS",
        transaction_key=payment_result.get("transactionKey", ""),
        approved_at=payment_result.get("approvedAt"),
        fail_reason=payment_result.get("failReason"),
        raw_response=payment_result,
    )
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)

    # ----- ⑥ 응답 -----
    return {
        "message": "Payment successful",
        "subscription": {
            "subscription_id": sub.id,
            "plan_name": plan.name,
            "start_date": str(sub.start_date),
            "end_date": str(sub.end_date),
            "is_active": sub.is_active,
        },
        "usage": {
            "allocated_minutes": sub.plan.allocated_minutes,
            "duration_days": sub.plan.duration_days,
        },
        "payment": {
            "payment_id": new_payment.id,
            "order_id": new_payment.order_id,
            "amount": float(new_payment.amount),
            "status": new_payment.status,
        },
    }
# 추이 그래프
logger = logging.getLogger(__name__)

@router.get("/today")
def get_payments_today(db: Session = Depends(get_db)):
    try:
        start = _today_local()            # 오늘 00:00 (로컬)
        end   = start + timedelta(days=1) # 내일 00:00 (배타)

        total = _sum_total_amount(db, start_date=start, end_date=end)
        return {"ok": True, "total": int(total or 0)}   # ← total_amount 아님!
    except Exception:
        logger.exception("GET /payments/today failed")
        raise HTTPException(status_code=500, detail="PAYMENTS_TODAY_FAILED")

def _collapse_rows_to_xy(rows):
    series = []
    for r in rows or []:
        x = getattr(r, "x", None) or getattr(r, "label", None) or getattr(r, "date", None) \
            or getattr(r, "week", None) or getattr(r, "month", None) or getattr(r, "year", None) or ""
        y = getattr(r, "y", None) or getattr(r, "count", None) or getattr(r, "value", None) \
            or getattr(r, "total", None) or 0
        series.append({"x": str(x), "y": int(y) if y is not None else 0})
    return series

@router.get("/last-7-days")
def last_7_days(db: Session = Depends(get_db)):
    try:
        items = get_payment_last_7_days_by_plan(db)
        return {"ok": True, "items": items}
    except Exception:
        logger.exception("GET /payments/last-7-days failed")
        raise HTTPException(status_code=500, detail="PAYMENTS_LAST_7_DAYS_FAILED")

@router.get("/last-5-weeks")
def last_5_weeks(db: Session = Depends(get_db)):
    try:
        items = get_payment_last_5_weeks_by_plan(db)
        return {"ok": True, "items": items}
    except Exception:
        logger.exception("GET /payments/last-5-weeks failed")
        raise HTTPException(status_code=500, detail="PAYMENTS_LAST_5_WEEKS_FAILED")

@router.get("/last-6-months")
def last_6_months(db: Session = Depends(get_db)):
    try:
        items = get_payment_last_6_months_by_plan(db)
        return {"ok": True, "items": items}
    except Exception:
        logger.exception("GET /payments/last-6-months failed")
        raise HTTPException(status_code=500, detail="PAYMENTS_LAST_6_MONTHS_FAILED")

@router.get("/last-5-years")
def last_5_years(db: Session = Depends(get_db)):
    try:
        items = get_payment_last_5_years_by_plan(db)
        return {"ok": True, "items": items}
    except Exception:
        logger.exception("GET /payments/last-5-years failed")
        raise HTTPException(status_code=500, detail="PAYMENTS_LAST_5_YEARS_FAILED")

@router.get("/me", response_model=PaymentListResponse)
def list_my_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # 필터
    date_from: Optional[date] = Query(None, description="포함(inclusive) 시작일"),
    date_to: Optional[date] = Query(None, description="포함(inclusive) 종료일"),
    status: Optional[str] = Query("SUCCESS", description="예: SUCCESS | SUCCESS,FAIL"),
    # 정렬/페이지네이션
    sort_by: str = Query(SortBy.APPROVED_AT, regex="^(approved_at|created_at)$"),
    sort_dir: str = Query("desc", regex="^(asc|desc)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    - 날짜 필터는 [date_from, date_to] 둘 다 '포함'으로 처리.
      구현 편의상 CRUD에서 date_to+1을 '미만'(<)으로 넘겨 주면 안전함.
    - status는 콤마로 여러 개 허용.
    - sort_by: approved_at|created_at / sort_dir: asc|desc
    """
    statuses = _parse_statuses(status)

    # inclusive end → half-open [from, to+1)
    date_to_exclusive = (date_to + timedelta(days=1)) if date_to else None

    total, items = get_my_payments(
        db,
        user_id=current_user.id,
        date_from=date_from,
        date_to=date_to_exclusive,   # CRUD에서는 < date_to_exclusive 로 처리
        statuses=statuses,           # 기존 단일 status -> 복수 허용으로 확장
        sort_by=sort_by,
        sort_dir=sort_dir,
        limit=limit,
        offset=offset,
    )

    # Pydantic 매핑 (from_attributes=True 전제)
    items_payload = [PaymentItem.model_validate(p) for p in items]

    # 다음 페이지 계산
    next_offset = offset + len(items_payload)
    has_more = next_offset < total

    return PaymentListResponse(
        total=total,
        items=items_payload,
        has_more=has_more,
        next_offset=next_offset if has_more else None,
    )


@router.get("/me/{payment_id}", response_model=PaymentItem)
def get_my_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = get_my_payment_detail(db, current_user.id, payment_id)
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    return PaymentItem.model_validate(p)

# 플랜 별 총 매출
@router.get("/revenue/plan")
def read_revenue_by_plan(db: Session = Depends(get_db)):
    return get_total_revenue_by_plan(db)

# 총 매출
@router.get("/total/amount")
def read_total_payment(db: Session = Depends(get_db)):
    """
    전체 기간 총 매출 (SUCCESS만).
    """
    return {"total": get_total_payment_amount(db)}

@router.get("/total/week")
def read_total_week(db: Session = Depends(get_db)):
    """이번 주 총매출 (월~오늘, 내일 0시 미만)"""
    return {"total": get_this_week_total_revenue(db)}

@router.get("/total/month")
def read_total_month(db: Session = Depends(get_db)):
    """이번 달 총매출 (1일~오늘, 내일 0시 미만)"""
    return {"total": get_this_month_total_revenue(db)}

@router.get("/total/year")
def read_total_year(db: Session = Depends(get_db)):
    """이번 년도 총매출 (YTD: 1/1~오늘, 내일 0시 미만)"""
    return {"total": get_this_year_total_revenue(db)}