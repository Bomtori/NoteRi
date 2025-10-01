# routers/subscription_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.model import Subscription, PlanType, User
from app.schemas.subscription_schema import SubscriptionResponse, SubscriptionUpdate
from app.deps.auth import get_current_user
from app.util.recording_usage import update_recording_usage
from datetime import date, timedelta

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# 구독 생성 쓸 곳 없음
# @router.post("/", response_model=SubscriptionResponse)
# def create_subscription(
#     sub: SubscriptionCreate,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user)
# ):
#     new_sub = Subscription(
#         user_id=current_user.id,
#         plan=sub.plan,
#         start_date=sub.start_date,
#         end_date=sub.end_date
#     )
#     db.add(new_sub)
#     db.commit()
#     db.refresh(new_sub)
#     return new_sub

# 구독 목록 조회
@router.get("/", response_model=list[SubscriptionResponse])
def list_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Subscription).filter(Subscription.user_id == current_user.id).all()


# 구독 단건 조회
@router.get("/{sub_id}", response_model=SubscriptionResponse)
def get_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sub = db.query(Subscription).filter(
        Subscription.id == sub_id,
        Subscription.user_id == current_user.id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return sub

# 구독 수정
@router.patch("/{sub_id}", response_model=SubscriptionResponse)
def update_subscription(
    sub_id: int,
    update: SubscriptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sub = db.query(Subscription).filter(
        Subscription.id == sub_id,
        Subscription.user_id == current_user.id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    # 업데이트 가능한 필드만 적용
    update_data = update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field in {"payment_info", "user_id", "created_at"}:
            continue
        setattr(sub, field, value)

    # ✅ 플랜 변경 시 30일 새 기간 부여
    if "plan" in update_data:
        sub.start_date = date.today()
        if sub.plan == PlanType.free:
            sub.end_date = None  # ✅ free는 무제한
        else:
            sub.end_date = date.today() + timedelta(days=30)

        # ✅ 녹음 사용량 갱신
        update_recording_usage(db, current_user.id, sub)

    db.commit()
    db.refresh(sub)
    return sub

# 구독 취소
@router.patch("/{sub_id}/cancel", response_model=SubscriptionResponse)
def cancel_subscription(
    sub_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sub = db.query(Subscription).filter(
        Subscription.id == sub_id,
        Subscription.user_id == current_user.id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if not sub.is_active:
        return {"message": "Already cancelled or expired", "subscription": sub}

    # ✅ 자동 갱신만 끊고 end_date까지는 유효
    sub.is_active = False
    db.commit()
    db.refresh(sub)

    return {
        "message": f"Subscription will remain active until {sub.end_date}, but won't renew afterwards.",
        "subscription": sub
    }

    # today = date.today()
    # valid_subscription = (
    #                              sub.is_active is True and sub.end_date >= today
    #                      ) or (
    #                              sub.is_active is False and sub.end_date >= today
    #                      )
    # 서비스 접근 시 체크 로직

