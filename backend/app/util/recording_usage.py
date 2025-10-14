from datetime import date, datetime, UTC
from sqlalchemy.orm import Session
from backend.app.model import RecordingUsage


class UsageExceededError(ValueError):
    """할당된 분수를 초과했을 때 발생하는 예외"""
    pass


def _get_active_usage(db: Session, user_id: int) -> RecordingUsage | None:
    """오늘 기준으로 유효한(또는 무기한) 최신 RecordingUsage 1개 반환"""
    return (
        db.query(RecordingUsage)
        .filter(
            RecordingUsage.user_id == user_id,
            (RecordingUsage.period_end == None) | (RecordingUsage.period_end >= date.today()),
        )
        .order_by(RecordingUsage.created_at.desc())
        .first()
    )


def use_minutes(db: Session, user_id: int, minutes: int) -> RecordingUsage:
    """
    녹음 종료 시 minutes 만큼 사용량 차감.
    - 무제한 플랜(allocated_minutes가 None 또는 음수)은 차감하지 않음.
    - 유한 플랜은 초과 시 UsageExceededError 발생.
    반환값: 업데이트된 RecordingUsage 객체
    """
    if minutes <= 0:
        raise ValueError("minutes must be positive")

    usage = _get_active_usage(db, user_id)
    if not usage:
        raise ValueError("No active recording usage found")

    # 무제한 처리: None 또는 음수는 무제한으로 간주
    if usage.allocated_minutes is None or (
        isinstance(usage.allocated_minutes, int) and usage.allocated_minutes < 0
    ):
        # 차감 없이 그대로 반환 (필요하면 여기서 활동 로그만 남기면 됨)
        return usage

    # 유한 플랜 차감
    new_used = int(usage.used_minutes or 0) + int(minutes)
    alloc = int(usage.allocated_minutes or 0)

    if new_used > alloc:
        remaining = max(alloc - int(usage.used_minutes or 0), 0)
        raise UsageExceededError(f"Recording minutes exceeded. remaining={remaining}")

    usage.used_minutes = new_used
    # (선택) updated_at 컬럼이 있다면 갱신:
    # usage.updated_at = datetime.now(UTC)

    db.commit()
    db.refresh(usage)
    return usage
