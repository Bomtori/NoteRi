# routers/payment.py
import os
import uuid
import httpx
import base64
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.deps.auth import get_current_user
from app.model import User
from app.db import SessionLocal
from app.model import Subscription, PlanType
from datetime import date, timedelta

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class PaymentRequest(BaseModel):
    plan: PlanType

router = APIRouter(prefix="/payments", tags=["payments"])

TOSS_SECRET_KEY = os.getenv("TOSS_SECRET_KEY")
SUCCESS_URL = os.getenv("PAYMENT_SUCCESS_URL")
FAIL_URL = os.getenv("PAYMENT_FAIL_URL")

PLAN_PRICE = {
    PlanType.free: 0,
    PlanType.pro: 10000,
    PlanType.enterprise: 20000,
}

# ✅ 결제 요청 API (변경 없음)
@router.post("/request")
def request_payment(
    req: PaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    plan = req.plan
    order_id = str(uuid.uuid4())
    amount = PLAN_PRICE[plan]

    return {
        "orderId": order_id,
        "amount": amount,
        "orderName": f"{plan.value} plan subscription",
        "customerEmail": current_user.email,
        "successUrl": f"{SUCCESS_URL}?orderId={order_id}&plan={plan.value}",
        "failUrl": FAIL_URL,
    }

class PaymentConfirmRequest(BaseModel):
    paymentKey: str
    orderId: str
    amount: int
    plan: PlanType

# ✅ 결제 승인 API (httpx.AsyncClient 사용)

@router.post("/confirm")
async def confirm_payment(
    req: PaymentConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    url = "https://api.tosspayments.com/v1/payments/confirm"

    encoded_secret = base64.b64encode(f"{TOSS_SECRET_KEY}:".encode()).decode()
    headers = {
        "Authorization": f"Basic {encoded_secret}",
        "Content-Type": "application/json"
    }
    data = {
        "paymentKey": req.paymentKey,
        "orderId": req.orderId,
        "amount": req.amount
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=data, headers=headers)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json())

    payment_result = response.json()  # ✅ 토스 결제 승인 결과 JSON

    # ✅ DB에 Subscription 생성하면서 payment_info에 저장
    new_sub = Subscription(
        user_id=current_user.id,
        plan=req.plan,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=30),
        is_active=True,
        payment_info=payment_result,  # ← 여기에 저장
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)

    return {
        "message": "Payment successful",
        "subscription": {
            "id": new_sub.id,
            "plan": new_sub.plan.value,
            "start_date": str(new_sub.start_date),
            "end_date": str(new_sub.end_date),
            "is_active": new_sub.is_active,
            "payment_info": new_sub.payment_info  # ✅ 응답에도 같이 반환
        }
    }