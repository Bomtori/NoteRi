from __future__ import annotations
from typing import Dict, Iterable, List, Optional, Tuple
from datetime import date, datetime

from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from backend.app.model import User, Subscription, Plan, Payment
from backend.app.schemas.admin_user_overview_schema import (
    AdminUserOverview,
    AdminUserOverviewListResponse,
)

def _collect_payment_maps(
    db: Session, user_ids: Iterable[int]
) -> Tuple[Dict[int, float], Dict[int, Optional[str]]]:
    """해당 사용자들에 대한 (총 결제액, 최신 결제 상태) 맵을 한 번에 생성"""
    user_ids = list(set(user_ids))
    if not user_ids:
        return {}, {}

    # 총 결제액 (SUCCESS만)
    total_paid_rows = (
        db.query(Payment.user_id, func.coalesce(func.sum(Payment.amount), 0.0))
        .filter(Payment.user_id.in_(user_ids), Payment.status == "SUCCESS")
        .group_by(Payment.user_id)
        .all()
    )
    total_paid_map: Dict[int, float] = {uid: float(total or 0.0) for uid, total in total_paid_rows}

    # 최신 결제 상태 (approved_at 최대)
    latest_ts_subq = (
        db.query(
            Payment.user_id.label("user_id"),
            func.max(Payment.approved_at).label("max_approved_at"),
        )
        .filter(Payment.user_id.in_(user_ids))
        .group_by(Payment.user_id)
        .subquery()
    )
    latest_rows = (
        db.query(Payment.user_id, Payment.status)
        .join(
            latest_ts_subq,
            and_(
                Payment.user_id == latest_ts_subq.c.user_id,
                Payment.approved_at == latest_ts_subq.c.max_approved_at,
            ),
        )
        .all()
    )
    latest_status_map: Dict[int, Optional[str]] = {uid: status for uid, status in latest_rows}

    return total_paid_map, latest_status_map


def _collect_latest_subscription_map(
    db: Session, user_ids: Iterable[int]
) -> Dict[int, Tuple[Optional[str], Optional[date], Optional[bool]]]:
    """
    각 user_id에 대해 최신 Subscription(또는 활성)을 골라
    (plan_name, end_date, is_active) 맵을 만든다.
    """
    user_ids = list(set(user_ids))
    if not user_ids:
        return {}

    today = date.today()

    # 활성 구독 우선 조회
    active_sub_rows = (
        db.query(
            Subscription.user_id,
            Plan.name.label("plan_name"),
            Subscription.end_date,
            Subscription.is_active,
            Subscription.start_date,
        )
        .join(Plan, Plan.id == Subscription.plan_id, isouter=True)
        .filter(
            Subscription.user_id.in_(user_ids),
            Subscription.start_date <= today,
            or_(Subscription.end_date == None, Subscription.end_date >= today),
            Subscription.is_active == True,
        )
        .order_by(Subscription.user_id.asc(), Subscription.start_date.desc().nullslast())
        .all()
    )
    latest_map: Dict[int, Tuple[Optional[str], Optional[date], Optional[bool]]] = {}
    for uid, plan_name, end_date, is_active, _ in active_sub_rows:
        if uid not in latest_map:  # user별 최신만
            # end_date가 datetime이면 date로 변환
            if isinstance(end_date, datetime):
                end_date = end_date.date()
            latest_map[uid] = (plan_name, end_date, is_active)

    # 활성 없던 유저는 전체 중 최신을 보정
    no_active_ids = [uid for uid in user_ids if uid not in latest_map]
    if no_active_ids:
        latest_any_rows = (
            db.query(
                Subscription.user_id,
                Plan.name.label("plan_name"),
                Subscription.end_date,
                Subscription.is_active,
                Subscription.start_date,
            )
            .join(Plan, Plan.id == Subscription.plan_id, isouter=True)
            .filter(Subscription.user_id.in_(no_active_ids))
            .order_by(Subscription.user_id.asc(), Subscription.start_date.desc().nullslast())
            .all()
        )
        for uid, plan_name, end_date, is_active, _ in latest_any_rows:
            if uid not in latest_map:
                if isinstance(end_date, datetime):
                    end_date = end_date.date()
                latest_map[uid] = (plan_name, end_date, is_active)

    return latest_map


def list_overviews(
    db: Session,
    page: int = 1,
    size: int = 20,
    q: Optional[str] = None,
) -> AdminUserOverviewListResponse:
    """운영자용 사용자 개요 리스트(페이지네이션)."""
    base = db.query(User)
    if q:
        like = f"%{q}%"
        base = base.filter(or_(User.name.ilike(like), User.email.ilike(like)))

    total = base.count()

    users: List[User] = (
        base.order_by(User.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    user_ids = [u.id for u in users]

    # 배치 집계
    total_paid_map, latest_status_map = _collect_payment_maps(db, user_ids)
    latest_sub_map = _collect_latest_subscription_map(db, user_ids)

    items: List[AdminUserOverview] = []
    for u in users:
        plan_name, end_date, sub_is_active = latest_sub_map.get(u.id, (None, None, None))
        payload = {
            "user_id": u.id,
            "name": getattr(u, "name", None),
            "email": getattr(u, "email", None),
            "is_banned": bool(getattr(u, "is_banned", False)),
            "banned_reason": getattr(u, "banned_reason", None),
            "banned_until": getattr(u, "banned_until", None),
            "is_active": bool(getattr(u, "is_active", True)),  # users.is_active
            "plan_name": plan_name,
            "subscription_is_active": sub_is_active,  # ✅ status 대신 is_active 노출
            "latest_payment_status": latest_status_map.get(u.id),
            "total_paid_amount": float(total_paid_map.get(u.id, 0.0)),
            "next_billing_date": end_date if sub_is_active else None,
            "joined_at": u.created_at,
        }
        items.append(AdminUserOverview(**payload))

    return AdminUserOverviewListResponse(total=total, items=items)


def get_overview(db: Session, user_id: int) -> Optional[AdminUserOverview]:
    """특정 사용자 개요(상세 패널용)."""
    u: Optional[User] = db.query(User).filter(User.id == user_id).one_or_none()
    if not u:
        return None

    total_paid_map, latest_status_map = _collect_payment_maps(db, [u.id])
    latest_sub_map = _collect_latest_subscription_map(db, [u.id])
    plan_name, end_date, sub_is_active = latest_sub_map.get(u.id, (None, None, None))

    payload = {
        "user_id": u.id,
        "name": getattr(u, "name", None),
        "email": getattr(u, "email", None),
        "is_banned": bool(getattr(u, "is_banned", False)),
        "banned_reason": getattr(u, "banned_reason", None),
        "banned_until": getattr(u, "banned_until", None),
        "is_active": bool(getattr(u, "is_active", True)),  # users.is_active
        "plan_name": plan_name,
        "subscription_is_active": sub_is_active,  # ✅ status 대신 is_active 노출
        "latest_payment_status": latest_status_map.get(u.id),
        "total_paid_amount": float(total_paid_map.get(u.id, 0.0)),
        "next_billing_date": end_date if sub_is_active else None,
        "joined_at": u.created_at,
    }
    return AdminUserOverview(**payload)
