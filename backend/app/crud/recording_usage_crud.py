# backend/app/crud/recording_usage_crud.py
from datetime import date, datetime, timedelta, UTC, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from sqlalchemy.exc import IntegrityError
from typing import Dict, Any, List, Tuple, Optional

from backend.app.model import RecordingUsage, Subscription, Plan, PlanType, AudioData, Board, RecordingUsageLog
from backend.app.util.day_calculation import (_today_local, _week_bounds, _month_bounds, _year_bounds)
from backend.app.util.errors import NotReadyError, AlreadyDebitedError, UsageExceededError
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


def use_seconds_from_audio_owner(db: Session, audio_id: int) -> RecordingUsage:
    """
    AudioData를 기반으로 RecordingUsage 사용량(seconds)을 차감한다.
    debited_at 없이 단순 차감만 수행한다.
    """

    # 1️⃣ AudioData 조회
    audio = db.query(AudioData).filter(AudioData.id == audio_id).first()
    if not audio:
        raise ValueError(f"AudioData {audio_id} not found")

    # 2️⃣ duration 검증
    if not audio.duration or audio.duration <= 0:
        raise NotReadyError(f"AudioData {audio_id} has no duration yet")

    # 3️⃣ board 기반 user_id 찾기
    board = db.query(Board).filter(Board.id == audio.board_id).first()
    if not board:
        raise ValueError(f"Board not found for AudioData {audio_id}")
    user_id = board.owner_id

    # 4️⃣ 활성 RecordingUsage 찾기 (현재 구독 기간 내)
    usage = (
        db.query(RecordingUsage)
        .filter(
            RecordingUsage.user_id == user_id,
            (RecordingUsage.period_end == None)
            | (RecordingUsage.period_end >= date.today()),
        )
        .order_by(RecordingUsage.created_at.desc())
        .first()
    )
    if not usage:
        raise ValueError(f"No active RecordingUsage found for user {user_id}")

    # 5️⃣ 사용량 계산
    used_now = int(usage.used_seconds or 0)
    add_seconds = int(audio.duration)
    total_used = used_now + add_seconds

    if usage.allocated_seconds and total_used > usage.allocated_seconds:
        raise UsageExceededError("사용량이 초과되었습니다.")

    usage.used_seconds = total_used

    # 6️⃣ 저장
    db.add(usage)
    db.commit()
    db.refresh(usage)

    print(f"💳 사용량 차감 완료: user_id={user_id}, +{add_seconds}s, total={total_used}s")
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
    start_30d = today - timedelta(days=29)  # 최근 30일 (오늘 포함)
    total_usage_30d = (
        db.query(func.sum(RecordingUsage.used_seconds))
        .filter(func.date(RecordingUsage.created_at) >= start_30d)
        .filter(func.date(RecordingUsage.created_at) <= today)
        .scalar()
    )
    return {
        "month": {
            "start_date": start_30d.isoformat(),
            "end_date": today.isoformat(),
            "total_seconds": int(total_usage_30d or 0),
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

KST = timezone(timedelta(hours=9))

def get_avg_usage_by_plan(db: Session):
    # Plan을 기준으로 시작 → 사용이 없어도 플랜은 항상 나옴

    rows = (
        db.query(
            func.lower(Plan.name).label("plan"),
            (func.avg(RecordingUsage.used_seconds) / 60.0).label("avg_used_minutes"),
            func.count(distinct(RecordingUsage.user_id)).label("sample_size"),
        )
        .select_from(Plan)
        .outerjoin(Subscription, Subscription.plan_id == Plan.id)
        .outerjoin(RecordingUsage, RecordingUsage.subscription_id == Subscription.id)
        .group_by(func.lower(Plan.name))
        .all()
    )

    return [
        {
            "plan": r.plan,
            "avg_used_minutes": round(float(r.avg_used_minutes or 0), 2),
            "sample_size": int(r.sample_size or 0),
        }
        for r in rows
    ]