from datetime import date, datetime, timedelta, UTC, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.model import RecordingUsage, Subscription, User, Plan, PlanType
from typing import Dict, Any, List, Tuple, Optional
from backend.app.util.day_calculation import (_today_local, _week_bounds, _month_bounds, _year_bounds)
def create_or_update_usage(db: Session, user_id: int, subscription: Subscription):
    """
    새 구독(Subscription) 발생 시 녹음 사용량(RecordingUsage) 생성 또는 갱신.
    이전 구독의 남은 시간을 이월하고, 플랜 정보(기간, 분수)는 Plan 테이블 기반으로 계산.
    """

    plan = subscription.plan  # FK로 연결된 Plan 객체
    if not plan:
        # raise ValueError("Subscription has no linked plan")
        raise ValueError(f"Subscription {subscription.id} has no linked plan") # 🍒 10.22 front결제오류로 수정


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


#### 모든 사용자의 사용량 조회

def get_total_usage_all_users(db:Session) ->int:
    total_usage = db.query(func.sum(RecordingUsage.used_minutes)).scalar()
    return total_usage or 0

# 오늘 사용량
def get_total_usage_today(db: Session) -> Dict[str, Any]:
    today = _today_local()
    total_usage_today = (
        db.query(func.sum(RecordingUsage.used_minutes))
        .filter(func.date(RecordingUsage.created_at) == today)
        .scalar()
        or 0
    )

    # ✅ 프론트에서 data.total 로 바로 접근 가능하게 구조 단순화
    return {
        "date": today.isoformat(),
        "total": total_usage_today
    }

def get_total_usage_last_7_days(db: Session) -> Dict[str, Any]:
    """
    최근 7일간의 총 사용량 (오늘 포함)
    """
    today = _today_local()
    seven_days_ago = today - timedelta(days=6)

    total_usage_7d = (
        db.query(func.sum(RecordingUsage.used_minutes))
        .filter(func.date(RecordingUsage.created_at) >= seven_days_ago)
        .filter(func.date(RecordingUsage.created_at) <= today)
        .scalar()
    )
    return {
        "last_7_days": {
            "start_date": seven_days_ago.isoformat(),
            "end_date": today.isoformat(),
            "total": total_usage_7d or 0
        }
    }


def get_total_usage_month(db: Session) -> Dict[str, Any]:
    """
    이번 달 총 사용량
    """
    today = _today_local()
    start_of_month = today.replace(day=1)

    total_usage_month = (
        db.query(func.sum(RecordingUsage.used_minutes))
        .filter(func.date(RecordingUsage.created_at) >= start_of_month)
        .filter(func.date(RecordingUsage.created_at) <= today)
        .scalar()
    )
    return {
        "month": {
            "start_date": start_of_month.isoformat(),
            "end_date": today.isoformat(),
            "total": total_usage_month or 0
        }
    }


def get_total_usage_year(db: Session) -> Dict[str, Any]:
    """
    올해 총 사용량
    """
    today = _today_local()
    start_of_year = today.replace(month=1, day=1)

    total_usage_year = (
        db.query(func.sum(RecordingUsage.used_minutes))
        .filter(func.date(RecordingUsage.created_at) >= start_of_year)
        .filter(func.date(RecordingUsage.created_at) <= today)
        .scalar()
    )
    return {
        "year": {
            "start_date": start_of_year.isoformat(),
            "end_date": today.isoformat(),
            "total": total_usage_year or 0
        }
    }

# 안전 합계 헬퍼
def _sum_used_minutes_between(db: Session, start: date, end: date) -> int:
    """
    [start, end] (양끝 포함) 구간의 used_minutes 합계
    """
    total = (
        db.query(func.sum(RecordingUsage.used_minutes))
        .filter(func.date(RecordingUsage.created_at) >= start)
        .filter(func.date(RecordingUsage.created_at) <= end)
        .scalar()
    )
    return int(total or 0)

def _delta(current: int, previous: int) -> Tuple[int, float]:
    """
    증감량과 증감률(%)을 반환. previous가 0이면 증감률은 0.0으로 처리.
    """
    d = current - previous
    if previous == 0:
        pct = 0.0 if current == 0 else 100.0  # 필요하면 정책에 맞게 조정
    else:
        pct = (d / previous) * 100.0
    return d, pct

def get_usage_comparisons(db: Session) -> Dict[str, Any]:
    """
    전일/전주/전월/전년 대비 총 사용량 증감 요약.
    반환 스키마:
    {
      "day":   {"current": X, "previous": Y, "delta": D, "pct": P, "range": {...}},
      "week":  {...},
      "month": {...},
      "year":  {...}
    }
    """
    today: date = _today_local()

    # ---- Day: 오늘 vs 어제 ----
    yesterday = today - timedelta(days=1)
    cur_day = _sum_used_minutes_between(db, today, today)
    prev_day = _sum_used_minutes_between(db, yesterday, yesterday)
    day_delta, day_pct = _delta(cur_day, prev_day)

    # ---- Week: 최근 7일 vs 그 이전 7일 ----
    # 현재주: [today-6, today], 이전주: [today-13, today-7]
    cur_w_start = today - timedelta(days=6)
    cur_w_end = today
    prev_w_start = today - timedelta(days=13)
    prev_w_end = today - timedelta(days=7)
    cur_week = _sum_used_minutes_between(db, cur_w_start, cur_w_end)
    prev_week = _sum_used_minutes_between(db, prev_w_start, prev_w_end)
    week_delta, week_pct = _delta(cur_week, prev_week)

    # ---- Month: 이번 달 MTD vs 저번 달 동일 일수 MTD ----
    # 이번 달 MTD: [월초, today]
    start_of_month = today.replace(day=1)
    cur_month = _sum_used_minutes_between(db, start_of_month, today)

    # 저번 달의 동일 일수 MTD 구하기
    # 지난달 월초
    if start_of_month.month == 1:
        prev_month_start = start_of_month.replace(year=start_of_month.year - 1, month=12)
    else:
        prev_month_start = start_of_month.replace(month=start_of_month.month - 1)

    # "이번 달 경과 일수"만큼 지난달도 포함 (예: 10월 21일이면 9월 1~21일)
    days_passed = (today - start_of_month).days
    prev_month_end = prev_month_start + timedelta(days=days_passed)
    cur_month = _sum_used_minutes_between(db, start_of_month, today)
    prev_month_val = _sum_used_minutes_between(db, prev_month_start, prev_month_end)
    month_delta, month_pct = _delta(cur_month, prev_month_val)

    # ---- Year: YTD vs 작년 YTD ----
    start_of_year = today.replace(month=1, day=1)
    cur_ytd = _sum_used_minutes_between(db, start_of_year, today)

    prev_year = today.year - 1
    prev_ytd_start = start_of_year.replace(year=prev_year)
    # "올해 경과 일수"만큼 작년도 포함
    ytd_days_passed = (today - start_of_year).days
    prev_ytd_end = prev_ytd_start + timedelta(days=ytd_days_passed)
    prev_ytd = _sum_used_minutes_between(db, prev_ytd_start, prev_ytd_end)
    year_delta, year_pct = _delta(cur_ytd, prev_ytd)

    return {
        "day": {
            "current": cur_day,
            "previous": prev_day,
            "delta": day_delta,
            "pct": day_pct,
            "range": {
                "current": {"start": today.isoformat(), "end": today.isoformat()},
                "previous": {"start": yesterday.isoformat(), "end": yesterday.isoformat()},
            },
        },
        "week": {
            "current": cur_week,
            "previous": prev_week,
            "delta": week_delta,
            "pct": week_pct,
            "range": {
                "current": {"start": cur_w_start.isoformat(), "end": cur_w_end.isoformat()},
                "previous": {"start": prev_w_start.isoformat(), "end": prev_w_end.isoformat()},
            },
        },
        "month": {
            "current": cur_month,
            "previous": prev_month_val,
            "delta": month_delta,
            "pct": month_pct,
            "range": {
                "current": {"start": start_of_month.isoformat(), "end": today.isoformat()},
                "previous": {"start": prev_month_start.isoformat(), "end": prev_month_end.isoformat()},
            },
        },
        "year": {
            "current": cur_ytd,
            "previous": prev_ytd,
            "delta": year_delta,
            "pct": year_pct,
            "range": {
                "current": {"start": start_of_year.isoformat(), "end": today.isoformat()},
                "previous": {"start": prev_ytd_start.isoformat(), "end": prev_ytd_end.isoformat()},
            },
        },
    }


def get_avg_usage_by_plan(db: Session):
    """
    free / pro / enterprise 별 평균 사용시간(분) 계산
    """
    rows = (
        db.query(
            Plan.name.label("plan_name"),
            func.avg(RecordingUsage.used_minutes).label("avg_used_minutes"),
            func.count(RecordingUsage.id).label("sample_size"),
        )
        .join(Subscription, Subscription.id == RecordingUsage.subscription_id)
        .join(Plan, Plan.id == Subscription.plan_id)
        .group_by(Plan.name)
        .all()
    )

    # JSON 직렬화하기 좋게 변환
    return [
        {
            "plan": row.plan_name.value if isinstance(row.plan_name, PlanType) else str(row.plan_name),
            "avg_used_minutes": round(float(row.avg_used_minutes or 0), 2),
            "sample_size": row.sample_size,
        }
        for row in rows
    ]