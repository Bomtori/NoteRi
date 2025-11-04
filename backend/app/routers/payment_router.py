# routers/payment_router.py
import logging
import os
import uuid
import asyncio
from typing import Optional, List, Tuple

import httpx
import base64

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session, joinedload        # ✅ joinedload 추가
from sqlalchemy import func, desc, Enum

from backend.app.deps.auth import get_current_user
from backend.app.model import User
from backend.app.db import get_db
from backend.app.model import Subscription, PlanType, Plan, Payment
from backend.app.schemas.payment_schema import PaymentListResponse, PaymentItem
from datetime import date, timedelta, datetime, UTC
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

class SortBy:
    # 필요 시 approved_at, created_at 등 확장
    APPROVED_AT = "approved_at"
    CREATED_AT = "created_at"

def _parse_statuses(status: Optional[str]) -> Optional[List[str]]:
    """
    status=SUCCESS or 'SUCCESS,FAIL' 처럼 들어온 값을 ['SUCCESS','FAIL']로 변환.
    None이면 필터 미적용.
    """
    if not status:
        return None
    # 공백 제거 + 빈 문자열 필터링
    arr = [s.strip() for s in status.split(",") if s.strip()]
    return arr or None

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
    current_user: User = Depends(get_current_user),
):
    # ✅ ② 멱등성 체크를 맨 앞으로 이동
    already = (
        db.query(Payment)
        .filter(Payment.order_id == req.orderId, Payment.status.in_(["SUCCESS", "DONE"]))
        .first()
    )
    if already:
        sub = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
        plan = db.query(Plan).get(sub.plan_id) if sub else None
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

    # ① 토스 결제 승인
    url = "https://api.tosspayments.com/v1/payments/confirm"
    encoded = base64.b64encode(f"{TOSS_SECRET_KEY}:".encode()).decode()
    headers = {"Authorization": f"Basic {encoded}", "Content-Type": "application/json"}
    data = {"paymentKey": req.paymentKey, "orderId": req.orderId, "amount": req.amount}

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=data, headers=headers)

        # ✅ Toss가 "S008 - 기존 요청 처리중"이라면 2초 뒤 재시도
        if resp.status_code != 200:
            try:
                detail = resp.json().get("detail", {})
                if isinstance(detail, dict) and detail.get("code") == "FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING":
                    await asyncio.sleep(2)
                    resp = await client.post(url, json=data, headers=headers)
            except Exception:
                pass
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.json())

    payment_result = resp.json()

    # ③ 플랜 조회 - ✅ 강력한 정규화
    # "PlanType.PRO" → "pro", "BASIC" → "basic", "Pro" → "pro"
    plan_name_input = req.plan_name
    if "PlanType." in plan_name_input:
        plan_name_input = plan_name_input.replace("PlanType.", "")
    plan_name_normalized = plan_name_input.lower().strip()
    
    print(f"🔍 플랜 조회 시도: 입력='{req.plan_name}' → 정규화='{plan_name_normalized}'")
    
    # ✅ Plan 테이블에서 대소문자 무시하고 조회
    plan = (
        db.query(Plan)
        .filter(func.lower(Plan.name) == plan_name_normalized)
        .first()
    )
    
    if not plan:
        # ✅ 디버깅: DB에 있는 모든 플랜 이름 출력
        all_plans = db.query(Plan.name).all()
        print(f"❌ 플랜을 찾을 수 없음. DB의 플랜 목록: {[p.name for p in all_plans]}")
        raise HTTPException(
            status_code=404, 
            detail=f"Invalid plan: '{req.plan_name}' (normalized: '{plan_name_normalized}')"
        )
    
    print(f"✅ 플랜 찾음: id={plan.id}, name={plan.name}")

    # ④ 구독 upsert
    billing_key = payment_result.get("billingKey")
    customer_key = payment_result.get("customerKey")

    sub = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    today = date.today()
    new_end = today + timedelta(days=plan.duration_days)

    if sub:
        old_plan_id = sub.plan_id
        sub.plan_id = plan.id
        sub.start_date = today
        sub.end_date = new_end
        sub.is_active = True
        sub.auto_renew = True
        if billing_key:
            sub.billing_key = billing_key
        if customer_key:
            sub.customer_key = customer_key
        sub.next_renew_on = new_end
        print(f"✅ 구독 업데이트: user_id={current_user.id}, plan_id {old_plan_id} → {plan.id}")
    else:
        sub = Subscription(
            user_id=current_user.id,
            plan_id=plan.id,
            start_date=today,
            end_date=new_end,
            is_active=True,
            auto_renew=True,
            billing_key=billing_key,
            customer_key=customer_key,
            next_renew_on=new_end,
        )
        db.add(sub)
        print(f"✅ 구독 생성: user_id={current_user.id}, plan_id={plan.id}")

    db.commit()
    db.refresh(sub)

    # ⑤ 사용량 갱신
    recording_usage_crud.create_or_update_usage(db, current_user.id, sub)

    # ⑥ 결제 레코드
    new_payment = Payment(
        user_id=current_user.id,
        subscription_id=sub.id,
        order_id=req.orderId,
        amount=req.amount,
        method=payment_result.get("method", "") or "",
        status=payment_result.get("status", "") or "SUCCESS",
        transaction_key=payment_result.get("transactionKey") or None,
        approved_at=payment_result.get("approvedAt"),
        fail_reason=payment_result.get("failReason"),
        raw_response=payment_result,
    )
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)

    # ✅ ⑦ Plan 이름 안전하게 추출
    raw_name = plan.name
    if isinstance(raw_name, Enum):
        effective_plan_name = raw_name.value.lower()
    else:
        effective_plan_name = str(raw_name).lower()

    print(f"✅ 결제 완료: subscription_id={sub.id}, plan_name={effective_plan_name}")

    # ✅ ⑧ 응답
    return {
        "message": "Payment successful",
        "subscription": {
            "subscription_id": sub.id,
            "plan_id": sub.plan_id,
            "plan_name": effective_plan_name,
            "start_date": str(sub.start_date),
            "end_date": str(sub.end_date),
            "is_active": sub.is_active,
            "auto_renew": sub.auto_renew,
        },
        "usage": {
            "allocated_seconds": plan.allocated_seconds,
            "duration_days": plan.duration_days,
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

@router.get("/me", response_model=list[PaymentItem])
def list_my_payments_simple(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    로그인한 사용자의 모든 결제 내역을 단순 리스트로 반환.
    (정렬: 최신 결제 순)
    """
    payments = (
        db.query(Payment)
        .join(Subscription, Subscription.id == Payment.subscription_id, isouter=True)
        .join(Plan, Plan.id == Subscription.plan_id, isouter=True)
        .filter(Payment.user_id == current_user.id)
        .order_by(Payment.approved_at.desc())
        .all()
    )

    # plan_name을 Payment 객체에 주입 (조인 라벨 대신)
    for p in payments:
        p.plan_name = p.subscription.plan.name if p.subscription and p.subscription.plan else None

    return [PaymentItem.model_validate(p, from_attributes=True) for p in payments]

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