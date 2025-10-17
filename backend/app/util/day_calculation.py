from __future__ import annotations
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from typing import Dict, Optional, Tuple, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.model import Payment, Subscription, Plan, PlanType

LOCAL_TZ = ZoneInfo("Asia/Seoul")  # 로컬 날짜 경계(캘린더 날짜) 기준

def _today_local() -> date:
    return datetime.now(LOCAL_TZ).date()

def _growth_rate(cur: float, prev: float) -> Optional[float]:
    if prev == 0:
        return None
    return (cur - prev) / prev

def _month_bounds(d: date) -> Tuple[date, date]:
    start = d.replace(day=1)
    if start.month == 12:
        end = date(start.year + 1, 1, 1)
    else:
        end = date(start.year, start.month + 1, 1)
    return start, end

def _year_bounds(d: date) -> Tuple[date, date]:
    return date(d.year, 1, 1), date(d.year + 1, 1, 1)

def _add_months(d: date, months: int) -> date:
    """달 단위 이동 (말일 안전)"""
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    # 목표 달의 말일 고려
    # 간단하게: 해당 달의 시작 + 다음달 시작 - 1일
    start = date(y, m, 1)
    if m == 12:
        next_start = date(y + 1, 1, 1)
    else:
        next_start = date(y, m + 1, 1)
    last_day = (next_start - timedelta(days=1)).day
    return date(y, m, min(d.day, last_day))