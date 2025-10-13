from datetime import date, datetime, timedelta, UTC
from sqlalchemy.orm import Session
from backend.app.model import RecordingUsage, Subscription


def create_or_update_usage(db: Session, user_id: int, subscription: Subscription):
    """
    새 구독(Subscription) 발생 시 녹음 사용량(RecordingUsage) 생성 또는 갱신.
    이전 구독의 남은 시간을 이월하고, 플랜 정보(기간, 분수)는 Plan 테이블 기반으로 계산.
    """

    plan = subscription.plan  # FK로 연결된 Plan 객체
    if not plan:
        raise ValueError("Subscription has no linked plan")

    # 기존 사용 기록 중 가장 최근 기록 조회
    prev_usage = (
        db.query(RecordingUsage)
        .filter(RecordingUsage.user_id == user_id)
        .order_by(RecordingUsage.period_end.desc().nulls_last())
        .first()
    )

    prev_remaining = 0
    if prev_usage and prev_usage.allocated_minutes is not None:
        prev_remaining = max(prev_usage.allocated_minutes - prev_usage.used_minutes, 0)

    # 현재 플랜 기준 minutes
    alloc = plan.allocated_minutes if plan.allocated_minutes >= 0 else None

    # free는 기간 무제한
    if plan.name == "free":
        period_start = date.today()
        period_end = None
    else:
        period_start = date.today()
        period_end = date.today() + timedelta(days=plan.duration_days)

    # enterprise는 무제한 minutes (allocated_minutes=None)
    if alloc is None:
        total_alloc = None
    else:
        total_alloc = alloc + prev_remaining  # 남은 시간 이월

    new_usage = RecordingUsage(
        user_id=user_id,
        subscription_id=subscription.id,
        allocated_minutes=total_alloc,
        used_minutes=0,
        period_start=period_start,
        period_end=period_end,
        created_at=datetime.now(UTC),
    )

    db.add(new_usage)
    db.commit()
    db.refresh(new_usage)

    return new_usage


def use_minutes(db: Session, user_id: int, minutes: int):
    """
    사용자가 녹음할 때마다 minutes만큼 사용량 차감
    (enterprise/free는 무제한이므로 차감 안함)
    """
    usage = (
        db.query(RecordingUsage)
        .filter(
            RecordingUsage.user_id == user_id,
            (RecordingUsage.period_end == None) | (RecordingUsage.period_end >= date.today()),
        )
        .order_by(RecordingUsage.created_at.desc())
        .first()
    )

    if not usage:
        raise ValueError("No active recording usage found")

    if usage.allocated_minutes is None:
        # 무제한 플랜 (enterprise/free)
        return usage

    new_used = usage.used_minutes + minutes
    if new_used > usage.allocated_minutes:
        raise ValueError("Recording minutes exceeded plan limit")

    usage.used_minutes = new_used
    db.commit()
    db.refresh(usage)

    return usage
