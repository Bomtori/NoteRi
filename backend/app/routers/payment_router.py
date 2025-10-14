# routers/payment_router.py
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
    get_my_payment_detail
)

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
        "successUrl": f"{SUCCESS_URL}?orderId={order_id}&plan={plan.name}",
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

    # ----- ② 플랜 조회 -----
    plan = db.query(Plan).filter(Plan.name == req.plan_name).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Invalid plan")

    # ----- ③ 구독 생성 -----
    new_sub = Subscription(
        user_id=current_user.id,
        plan_id=plan.id,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=plan.duration_days),
        is_active=True
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)

    # ----- ✅ ④ 녹음 사용량 자동 생성 -----
    recording_usage_crud.create_or_update_usage(db, current_user.id, new_sub)

    # ----- ⑤ 결제 내역 기록 -----
    new_payment = Payment(
        user_id=current_user.id,
        subscription_id=new_sub.id,
        order_id=req.orderId,
        amount=req.amount,
        method=payment_result.get("method", ""),
        status=payment_result.get("status", ""),
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
            "subscription_id": new_sub.id,
            "plan_name": plan.name,
            "start_date": str(new_sub.start_date),
            "end_date": str(new_sub.end_date),
            "is_active": new_sub.is_active,
        },
        "usage": {
            "allocated_minutes": new_sub.plan.allocated_minutes,
            "duration_days": new_sub.plan.duration_days,
        },
        "payment": {
            "payment_id": new_payment.id,
            "order_id": new_payment.order_id,
            "amount": float(new_payment.amount),
            "status": new_payment.status,
        },
    }
# 추이 그래프
@router.get("/today")
def today(db: Session = Depends(get_db)):
    return get_payment_today_by_plan(db)

@router.get("/last-7-days")
def last_7_days(db: Session = Depends(get_db)):
    return get_payment_last_7_days_by_plan(db)

@router.get("/last-5-weeks")
def last_5_weeks(db: Session = Depends(get_db)):
    return get_payment_last_5_weeks_by_plan(db )

@router.get("/last-6-months")
def last_6_months(db: Session = Depends(get_db) ):
    return get_payment_last_6_months_by_plan(db )

@router.get("/last-5-years")
def last_5_years(db: Session = Depends(get_db) ):
    return get_payment_last_5_years_by_plan(db )

@router.get("/me/payments", response_model=PaymentListResponse)
def list_my_payments(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status: Optional[str] = Query("SUCCESS", description="SUCCESS|PENDING|FAIL|CANCELED 등"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    total, items = get_my_payments(
        db,
        user_id=current_user.id,
        date_from=date_from,
        date_to=date_to,
        status=status,
        limit=limit,
        offset=offset,
    )
    # Pydantic 변환: PaymentItem(orm_mode=True) 사용
    payload_items = [
        PaymentItem(
            id=p.id,
            order_id=p.order_id,
            amount=p.amount,
            method=p.method,
            status=p.status,
            transaction_key=p.transaction_key,
            approved_at=p.approved_at,
            canceled_at=p.canceled_at,
            subscription_id=p.subscription_id,
            plan_name=getattr(p, "plan_name", None),
        )
        for p in items
    ]
    return {"total": total, "items": payload_items}


@router.get("/{payment_id}", response_model=PaymentItem)
def get_my_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    p = get_my_payment_detail(db, current_user.id, payment_id)
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    return PaymentItem(
        id=p.id,
        order_id=p.order_id,
        amount=p.amount,
        method=p.method,
        status=p.status,
        transaction_key=p.transaction_key,
        approved_at=p.approved_at,
        canceled_at=p.canceled_at,
        subscription_id=p.subscription_id,
        plan_name=getattr(p, "plan_name", None),
    )