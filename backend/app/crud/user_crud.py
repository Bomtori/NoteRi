from sqlalchemy.orm import Session
from sqlalchemy import func, extract, text
from backend.app.model import User
from datetime import datetime, timedelta, date
from typing import Dict, Any, List

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