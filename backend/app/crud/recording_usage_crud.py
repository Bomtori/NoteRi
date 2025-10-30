# backend/app/crud/recording_usage_crud.py
from datetime import date, datetime, timedelta, UTC
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from typing import Dict, Any, List, Tuple, Optional

from backend.app.model import RecordingUsage, Subscription, Plan, PlanType, AudioData, Board, RecordingUsageLog
from backend.app.util.day_calculation import (_today_local, _week_bounds, _month_bounds, _year_bounds)

# 선택: 초과 에러 전용 예외
class UsageExceededError(ValueError):
    pass

def create_or_update_usage(db: Session, user_id: int, subscription: Subscription):
    """
    새 구독 발생 시 녹음 사용량(초 단위) 생성 또는 갱신.
    이전 구독의 '남은 초'를 이월하고, Plan의 allocated_seconds 초 단위로 환산.
    """
    plan = subscription.plan
    if not plan:
        # raise ValueError("Subscription has no linked plan")
        raise ValueError(f"Subscription {subscription.id} has no linked plan") # 🍒 10.22 front결제오류로 수정


    prev_usage = (
        db.query(RecordingUsage)
        .filter(RecordingUsage.user_id == user_id)
        .order_by(RecordingUsage.period_end.desc().nulls_last())
        .first()
    )

    prev_remaining = 0
    if prev_usage and prev_usage.allocated_seconds is not None:
        prev_remaining = max(int(prev_usage.allocated_seconds) - int(prev_usage.used_seconds or 0), 0)

    # 분→초 환산 (None=무제한)
    if plan.allocated_seconds is None or plan.allocated_seconds < 0:
        alloc_seconds = None
    else:
        alloc_seconds = int(plan.allocated_seconds) * 60

    # free는 기간 무제한
    if plan.name == "free":
        period_start = date.today()
        period_end = None
    else:
        period_start = date.today()
        period_end = date.today() + timedelta(days=plan.duration_days)

    # 무제한이면 None 유지, 아니면 이월분 더하기
    if alloc_seconds is None:
        total_alloc = None
    else:
        total_alloc = alloc_seconds + prev_remaining

    new_usage = RecordingUsage(
        user_id=user_id,
        subscription_id=subscription.id,
        allocated_seconds=total_alloc,
        used_seconds=0,
        period_start=period_start,
        period_end=period_end,
        created_at=datetime.now(UTC),
    )

    db.add(new_usage)
    db.commit()
    db.refresh(new_usage)
    return new_usage


def use_seconds_from_audio_owner(db: Session, audio_id: int):
    # 1) 오디오 조회(+ 보드)
    audio = (
        db.query(AudioData.id, AudioData.duration, AudioData.board_id, AudioData.debited_at)
        .filter(AudioData.id == audio_id)
        .with_for_update()  # 오디오 행도 잠깐 락(중복 차감 방지 강화)
        .first()
    )
    if not audio:
        raise ValueError("AudioData not found")
    if audio.duration is None or int(audio.duration) <= 0:
        raise ValueError("AudioData.duration 이 유효하지 않습니다.")
    if audio.debited_at is not None:
        # 이미 차감된 오디오
        raise ValueError("이미 차감 처리된 Audio 입니다.")

    # 2) 보드의 owner 찾기
    owner_id = db.query(Board.owner_id).filter(Board.id == audio.board_id).scalar()
    if owner_id is None:
        raise ValueError("Board owner를 찾을 수 없습니다.")

    # 3) owner의 '활성' RecordingUsage (가장 최신) 잠금
    usage = (
        db.query(RecordingUsage)
        .filter(
            RecordingUsage.user_id == owner_id,
            (RecordingUsage.period_end == None) | (RecordingUsage.period_end >= date.today()),
        )
        .order_by(RecordingUsage.created_at.desc())
        .with_for_update()  # 🔒 사용량 집계 락
        .first()
    )
    if not usage:
        raise ValueError("No active recording usage found for board owner")

    # 4) 무제한이면 로그만(원하면) 남기고 반환
    seconds = int(audio.duration)
    if usage.allocated_seconds is None:
        # 필요시 무제한도 로그를 남기려면 여기에서 insert
        # log = RecordingUsageLog(..., before_used=usage.used_seconds or 0, after_used=usage.used_seconds or 0)
        # db.add(log)
        # audio.debited_at = func.now()
        # db.commit(); db.refresh(usage)
        audio_row = db.query(AudioData).get(audio_id)
        audio_row.debited_at = func.now()
        db.commit()
        db.refresh(usage)
        return usage

    # 5) 차감 계산
    before_used = int(usage.used_seconds or 0)
    after_used = before_used + seconds
    if after_used > int(usage.allocated_seconds):
        raise UsageExceededError("Recording seconds exceeded plan limit")

    # 6) 반영 + 로그
    usage.used_seconds = after_used
    log = RecordingUsageLog(
        usage_id=usage.id,
        user_id=owner_id,
        board_id=audio.board_id,
        audio_id=audio_id,
        seconds=seconds,
        before_used=before_used,
        after_used=after_used,
        reason="audio_duration",
    )
    db.add(log)

    # 7) 중복 차감 방지 플래그
    audio_row = db.query(AudioData).get(audio_id)
    audio_row.debited_at = func.now()

    # 8) 커밋
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # audio_id unique 제약에 걸린 경우(중복 차감 시도)
        raise ValueError("이미 차감 처리된 Audio 입니다.")

    db.refresh(usage)
    return usage


# ===== 집계/통계도 전부 '초' 기준 =====

def get_total_usage_all_users(db: Session) -> int:
    total_usage = db.query(func.sum(RecordingUsage.used_seconds)).scalar()
    return int(total_usage or 0)

def get_total_usage_today(db: Session) -> Dict[str, Any]:
    today = _today_local()
    total_usage_today = (
        db.query(func.sum(RecordingUsage.used_seconds))
        .filter(func.date(RecordingUsage.created_at) == today)
        .scalar()
        or 0
    )
    return {"date": today.isoformat(), "total_seconds": int(total_usage_today)}

def get_total_usage_last_7_days(db: Session) -> Dict[str, Any]:
    today = _today_local()
    seven_days_ago = today - timedelta(days=6)
    total_usage_7d = (
        db.query(func.sum(RecordingUsage.used_seconds))
        .filter(func.date(RecordingUsage.created_at) >= seven_days_ago)
        .filter(func.date(RecordingUsage.created_at) <= today)
        .scalar()
    )
    return {
        "last_7_days": {
            "start_date": seven_days_ago.isoformat(),
            "end_date": today.isoformat(),
            "total_seconds": int(total_usage_7d or 0),
        }
    }

def get_total_usage_month(db: Session) -> Dict[str, Any]:
    today = _today_local()
    start_of_month = today.replace(day=1)
    total_usage_month = (
        db.query(func.sum(RecordingUsage.used_seconds))
        .filter(func.date(RecordingUsage.created_at) >= start_of_month)
        .filter(func.date(RecordingUsage.created_at) <= today)
        .scalar()
    )
    return {
        "month": {
            "start_date": start_of_month.isoformat(),
            "end_date": today.isoformat(),
            "total_seconds": int(total_usage_month or 0),
        }
    }

def get_total_usage_year(db: Session) -> Dict[str, Any]:
    today = _today_local()
    start_of_year = today.replace(month=1, day=1)
    total_usage_year = (
        db.query(func.sum(RecordingUsage.used_seconds))
        .filter(func.date(RecordingUsage.created_at) >= start_of_year)
        .filter(func.date(RecordingUsage.created_at) <= today)
        .scalar()
    )
    return {
        "year": {
            "start_date": start_of_year.isoformat(),
            "end_date": today.isoformat(),
            "total_seconds": int(total_usage_year or 0),
        }
    }

def _sum_used_seconds_between(db: Session, start: date, end: date) -> int:
    total = (
        db.query(func.sum(RecordingUsage.used_seconds))
        .filter(func.date(RecordingUsage.created_at) >= start)
        .filter(func.date(RecordingUsage.created_at) <= end)
        .scalar()
    )
    return int(total or 0)

def _delta(current: int, previous: int) -> Tuple[int, float]:
    d = current - previous
    if previous == 0:
        pct = 0.0 if current == 0 else 100.0
    else:
        pct = (d / previous) * 100.0
    return d, pct

def get_usage_comparisons(db: Session) -> Dict[str, Any]:
    today: date = _today_local()

    # Day
    yesterday = today - timedelta(days=1)
    cur_day = _sum_used_seconds_between(db, today, today)
    prev_day = _sum_used_seconds_between(db, yesterday, yesterday)
    day_delta, day_pct = _delta(cur_day, prev_day)

    # Week (7일)
    cur_w_start = today - timedelta(days=6)
    cur_w_end = today
    prev_w_start = today - timedelta(days=13)
    prev_w_end = today - timedelta(days=7)
    cur_week = _sum_used_seconds_between(db, cur_w_start, cur_w_end)
    prev_week = _sum_used_seconds_between(db, prev_w_start, prev_w_end)
    week_delta, week_pct = _delta(cur_week, prev_week)

    # Month MTD vs prev month MTD(동일일수)
    start_of_month = today.replace(day=1)
    cur_month = _sum_used_seconds_between(db, start_of_month, today)
    if start_of_month.month == 1:
        prev_month_start = start_of_month.replace(year=start_of_month.year - 1, month=12)
    else:
        prev_month_start = start_of_month.replace(month=start_of_month.month - 1)
    days_passed = (today - start_of_month).days
    prev_month_end = prev_month_start + timedelta(days=days_passed)
    prev_month_val = _sum_used_seconds_between(db, prev_month_start, prev_month_end)
    month_delta, month_pct = _delta(cur_month, prev_month_val)

    # YTD vs LYTD
    start_of_year = today.replace(month=1, day=1)
    cur_ytd = _sum_used_seconds_between(db, start_of_year, today)
    prev_year = today.year - 1
    prev_ytd_start = start_of_year.replace(year=prev_year)
    ytd_days_passed = (today - start_of_year).days
    prev_ytd_end = prev_ytd_start + timedelta(days=ytd_days_passed)
    prev_ytd = _sum_used_seconds_between(db, prev_ytd_start, prev_ytd_end)
    year_delta, year_pct = _delta(cur_ytd, prev_ytd)

    return {
        "day":   {"current_seconds": cur_day,  "previous_seconds": prev_day,  "delta_seconds": day_delta,  "pct": day_pct,
                  "range": {"current": {"start": today.isoformat(), "end": today.isoformat()},
                            "previous": {"start": yesterday.isoformat(), "end": yesterday.isoformat()}}},
        "week":  {"current_seconds": cur_week,"previous_seconds": prev_week,"delta_seconds": week_delta,"pct": week_pct,
                  "range": {"current": {"start": cur_w_start.isoformat(), "end": cur_w_end.isoformat()},
                            "previous": {"start": prev_w_start.isoformat(), "end": prev_w_end.isoformat()}}},
        "month": {"current_seconds": cur_month,"previous_seconds": prev_month_val,"delta_seconds": month_delta,"pct": month_pct,
                  "range": {"current": {"start": start_of_month.isoformat(), "end": today.isoformat()},
                            "previous": {"start": prev_month_start.isoformat(), "end": prev_month_end.isoformat()}}},
        "year":  {"current_seconds": cur_ytd,"previous_seconds": prev_ytd,"delta_seconds": year_delta,"pct": year_pct,
                  "range": {"current": {"start": start_of_year.isoformat(), "end": today.isoformat()},
                            "previous": {"start": prev_ytd_start.isoformat(), "end": prev_ytd_end.isoformat()}}},
    }

def get_avg_usage_by_plan(db: Session):
    rows = (
        db.query(
            Plan.name.label("plan_name"),
            func.avg(RecordingUsage.used_seconds).label("avg_used_seconds"),
            func.count(RecordingUsage.id).label("sample_size"),
        )
        .join(Subscription, Subscription.id == RecordingUsage.subscription_id)
        .join(Plan, Plan.id == Subscription.plan_id)
        .group_by(Plan.name)
        .all()
    )

    return [
        {
            "plan": getattr(row.plan_name, "value", str(row.plan_name)),
            "avg_used_seconds": round(float(row.avg_used_seconds or 0), 2),
            "sample_size": row.sample_size,
        }
        for row in rows
    ]
