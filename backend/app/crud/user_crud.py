from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session
from sqlalchemy import func, extract, text, case
from backend.app.model import User, Plan, Subscription
from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Tuple, Optional
from backend.app.util.day_calculation import (
_today_local,
_add_months,
_growth_rate,
_month_bounds,
_year_bounds,
)

# 모든 유저 숫자 확인
def get_total_users_count(db: Session) -> int:
    return db.query(User).count()

# 비활성 유저 숫자 확인
def get_no_active_users_count(db: Session) -> int:
    return db.query(User).filter(User.is_active==False).count()

# OAuth 제공자 별 가입자 수 반환
def get_user_count_by_provider(db: Session):
    results = (
        db.query(User.oauth_provider, func.count(User.id))
        .group_by(User.oauth_provider)
        .all()
    )

    # provider가 None인 경우를 'none'으로 치환
    provider_stats = {provider or "none": count for provider, count in results}
    return provider_stats

# 1) 오늘 가입자 수
def get_user_signup_today_stats(db: Session) -> Dict[str, Any]:
    today = date.today()
    count = (
        db.query(func.count(User.id))
        .filter(func.date(User.created_at) == today)
        .scalar()
    )
    return {"today": {"date": today.isoformat(), "count": count}}


# 2) 최근 7일 추이 (일 단위, 오늘 포함) — 빈 날짜 0 채움
def get_user_signup_last_7_days(db: Session) -> Dict[str, Any]:
    end = date.today()
    start = end - timedelta(days=6)

    sql = text("""
        WITH series AS (
            SELECT generate_series(CAST(:start AS date), CAST(:end AS date), INTERVAL '1 day')::date AS d
        ),
        counts AS (
            SELECT DATE(u.created_at) AS d, COUNT(*) AS cnt
            FROM users u
            WHERE DATE(u.created_at) BETWEEN :start AND :end
            GROUP BY 1
        )
        SELECT s.d AS bucket, COALESCE(c.cnt, 0) AS count
        FROM series s
        LEFT JOIN counts c ON c.d = s.d
        ORDER BY s.d
    """)
    rows = db.execute(sql, {"start": start.isoformat(), "end": end.isoformat()}).fetchall()

    data = [{"date": r.bucket.isoformat(), "count": r.count} for r in rows]
    total = sum(x["count"] for x in data)
    return {"range": {"start": start.isoformat(), "end": end.isoformat()}, "granularity": "day", "total": total, "data": data}


# 3) 최근 5주 추이 (주 단위, 현재 주 포함) — 주 시작일(월요일) 기준 버킷
def get_user_signup_last_5_weeks(db: Session) -> Dict[str, Any]:
    today = date.today()
    this_week_start = today - timedelta(days=today.weekday())
    start = this_week_start - timedelta(weeks=4)
    end = this_week_start  # 현재 주 시작까지 5개 버킷

    sql = text("""
        WITH series AS (
            SELECT generate_series(
                CAST(:start AS date),
                CAST(:end   AS date),
                INTERVAL '1 week'
            )::date AS week_start
        ),
        counts AS (
            SELECT date_trunc('week', u.created_at)::date AS week_start, COUNT(*) AS cnt
            FROM users u
            WHERE u.created_at::date >= :start AND u.created_at::date <= :end
            GROUP BY 1
        )
        SELECT s.week_start AS bucket, COALESCE(c.cnt, 0) AS count
        FROM series s
        LEFT JOIN counts c ON c.week_start = s.week_start
        ORDER BY s.week_start
    """)
    rows = db.execute(sql, {"start": start.isoformat(), "end": end.isoformat()}).fetchall()

    data = [{"week_start": r.bucket.isoformat(), "count": r.count} for r in rows]
    total = sum(x["count"] for x in data)
    return {"range": {"start": start.isoformat(), "end": end.isoformat()}, "granularity": "week", "total": total, "data": data}


# 4) 최근 6개월 추이 (월 단위, 이번 달 포함) — YYYY-MM 라벨
def get_user_signup_last_6_months(db: Session) -> Dict[str, Any]:
    today = date.today()
    this_month_start = date(today.year, today.month, 1)

    # 5개월 전의 1일 구하기
    month = this_month_start.month
    year = this_month_start.year
    for _ in range(5):
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    start = date(year, month, 1)
    end = this_month_start

    sql = text("""
        WITH series AS (
            SELECT generate_series(
                date_trunc('month', CAST(:start AS timestamp)),
                date_trunc('month', CAST(:end   AS timestamp)),
                INTERVAL '1 month'
            )::date AS month_start
        ),
        counts AS (
            SELECT date_trunc('month', u.created_at)::date AS month_start, COUNT(*) AS cnt
            FROM users u
            WHERE u.created_at::date >= :start AND u.created_at::date <= :end
            GROUP BY 1
        )
        SELECT s.month_start AS bucket, COALESCE(c.cnt, 0) AS count
        FROM series s
        LEFT JOIN counts c ON c.month_start = s.month_start
        ORDER BY s.month_start
    """)
    rows = db.execute(sql, {"start": start.isoformat(), "end": end.isoformat()}).fetchall()

    data = [{"month": f"{r.bucket.year:04d}-{r.bucket.month:02d}", "count": r.count} for r in rows]
    total = sum(x["count"] for x in data)
    return {"range": {"start": start.isoformat(), "end": end.isoformat()}, "granularity": "month", "total": total, "data": data}


# 5) 최근 5년 추이 (연 단위, 올해 포함) — YYYY 라벨
def get_user_signup_last_5_years(db: Session) -> Dict[str, Any]:
    today = date.today()
    this_year_start = date(today.year, 1, 1)
    start = date(today.year - 4, 1, 1)
    end = this_year_start

    sql = text("""
        WITH series AS (
            SELECT generate_series(
                date_trunc('year', CAST(:start AS timestamp)),
                date_trunc('year', CAST(:end   AS timestamp)),
                INTERVAL '1 year'
            )::date AS year_start
        ),
        counts AS (
            SELECT date_trunc('year', u.created_at)::date AS year_start, COUNT(*) AS cnt
            FROM users u
            WHERE u.created_at::date >= :start AND u.created_at::date <= :end
            GROUP BY 1
        )
        SELECT s.year_start AS bucket, COALESCE(c.cnt, 0) AS count
        FROM series s
        LEFT JOIN counts c ON c.year_start = s.year_start
        ORDER BY s.year_start
    """)
    rows = db.execute(sql, {"start": start.isoformat(), "end": end.isoformat()}).fetchall()

    data = [{"year": f"{r.bucket.year:04d}", "count": r.count} for r in rows]
    total = sum(x["count"] for x in data)
    return {"range": {"start": start.isoformat(), "end": end.isoformat()}, "granularity": "year", "total": total, "data": data}

LOCAL_TZ = ZoneInfo("Asia/Seoul")  # 로컬 날짜 경계(캘린더 날짜) 기준

def _count_signups(
    db: Session,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,   # [start, end)
) -> int:
    q = db.query(func.count(User.id))
    if start_date is not None:
        q = q.filter(func.date(User.created_at) >= start_date)
    if end_date is not None:
        q = q.filter(func.date(User.created_at) < end_date)
    return int(q.scalar() or 0)


# ---------- 1) 최근 일주일 간 가입자 ----------
def get_last_7d_signups(db: Session) -> int:
    """
    오늘 포함 최근 7일 (오늘~6일 전). [start, end) = [today-6, tomorrow)
    """
    today = _today_local()
    start = today - timedelta(days=6)
    end = today + timedelta(days=1)
    return _count_signups(db, start_date=start, end_date=end)


# ---------- 2) 최근 6개월 간 가입자 ----------
def get_last_6m_signups(db: Session) -> int:
    """
    오늘 기준 '달' 단위로 6개월 전 같은 일자부터 오늘까지.
    예) 10월 15일이라면 4월 15일~10월 15일(포함). [start, end) = [six_months_ago, tomorrow)
    """
    today = _today_local()
    start = _add_months(today, -6)
    end = today + timedelta(days=1)
    return _count_signups(db, start_date=start, end_date=end)


# ---------- 3) 최근 1년 간 가입자 ----------
def get_last_12m_signups(db: Session) -> int:
    """
    오늘 기준 1년 전 같은 일자부터 오늘까지.
    [start, end) = [one_year_ago, tomorrow)
    """
    today = _today_local()
    start = _add_months(today, -12)
    end = today + timedelta(days=1)
    return _count_signups(db, start_date=start, end_date=end)


# ---------- 4) 전월 대비 가입자 성장률 ----------
def get_mom_signup_growth(db: Session) -> dict:
    """
    현재달 MTD(이달 1일~오늘) vs 전월 동일일수(전월 1일~전월 today.day).
    반환: {"current": int, "previous": int, "growth_rate": float|None}
    """
    today = _today_local()

    # 현재달: [이달 1일, 내일)
    cur_start, _cur_month_end = _month_bounds(today)
    cur_end = today + timedelta(days=1)
    current = _count_signups(db, start_date=cur_start, end_date=cur_end)

    # 전월: [전월 1일, 전월 today.day 다음날)  (말일 안전)
    prev_anchor = cur_start - timedelta(days=1)  # 전월 내 임의 날짜
    prev_m_start, prev_m_end = _month_bounds(prev_anchor)
    prev_last_day = (prev_m_end - timedelta(days=1)).day
    prev_end_day = min(today.day, prev_last_day)
    prev_end = prev_m_start + timedelta(days=prev_end_day)  # 다음날 0시
    previous = _count_signups(db, start_date=prev_m_start, end_date=prev_end)

    growth_rate = None if previous == 0 else (current - previous) / previous
    return {"current": current, "previous": previous, "growth_rate": growth_rate}


# ---------- 5) 전년 대비 가입자 성장률 ----------
def get_yoy_signup_growth(db: Session) -> dict:
    """
    YTD(올해 1/1~오늘) vs 전년 동기(작년 1/1~작년 같은 월/일).
    반환: {"current": int, "previous": int, "growth_rate": float|None}
    """
    today = _today_local()

    cur_y_start, _ = _year_bounds(today)
    cur_end = today + timedelta(days=1)
    current = _count_signups(db, start_date=cur_y_start, end_date=cur_end)

    last_year_same_day = _add_months(today, -12)  # 작년 같은 월/일 (말일 안전 처리)
    prev_y_start, _prev_y_end = _year_bounds(last_year_same_day)
    # 전년 동기의 길이를 올해 YTD와 동일하게 맞춤
    prev_period_days = (today - cur_y_start).days + 1  # 오늘 포함 일수
    prev_end = prev_y_start + timedelta(days=prev_period_days)
    previous = _count_signups(db, start_date=prev_y_start, end_date=prev_end)

    growth_rate = None if previous == 0 else (current - previous) / previous
    return {"current": current, "previous": previous, "growth_rate": growth_rate}