# backend/app/scheduler.py
from datetime import date, timedelta, UTC, datetime, time
from typing import Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from backend.app.db import SessionLocal
from backend.app.model import Subscription, Plan, PlanType, Payment, User, Notification, CalendarEvent
from backend.app.crud import recording_usage_crud

_scheduler: Optional[AsyncIOScheduler] = None
KST = ZoneInfo("Asia/Seoul")
def _with_session(fn):
    """DB 세션을 열고 닫는 데코레이터(스케줄러 잡용)."""
    def wrapper(*args, **kwargs):
        db: Session = SessionLocal()
        try:
            return fn(db, *args, **kwargs)
        finally:
            db.close()
    return wrapper

@_with_session
def expire_subscriptions(db: Session):
    """만료된 구독을 free로 전환 (end_date < today)."""
    today = date.today()

    expired = (
        db.query(Subscription)
        .filter(
            Subscription.end_date < today,
            Subscription.is_active == True,     # ✅ SQL 비교
        )
        .all()
    )
    if not expired:
        return

    free_plan = db.query(Plan).filter(Plan.name == PlanType.free).first()
    if not free_plan:
        print("[Scheduler] Free plan not found; skip.")
        return

    for sub in expired:
        sub.plan_id = free_plan.id      # ✅ 관계가 아니라 FK를 갱신
        sub.is_active = False
        sub.auto_renew = False
        sub.next_renew_on = None
        sub.billing_key = None  # 정책상 만료 시 빌링키 유지할지 해제할지 결정

    db.commit()
    print(f"[Scheduler] {len(expired)} subscriptions expired → free.")

@_with_session
def renew_due_subscriptions(db: Session):
    """자동갱신 대상 결제 → 기간 연장 + 결제 레코드 생성."""
    today = date.today()

    due = (
        db.query(Subscription)
        .join(Plan)
        .filter(
            Subscription.is_active == True,
            Subscription.auto_renew == True,
            Subscription.billing_key.isnot(None),
            Subscription.next_renew_on <= today,
        )
        .all()
    )

    processed = success = failed = 0

    for sub in due:
        processed += 1
        try:
            amount = int(sub.plan.price)
            order_id = f"renew_{sub.id}_{today.isoformat()}"

            # 멱등성: 동일 order_id 성공건 이미 있으면 skip
            dup = (
                db.query(Payment)
                .filter(Payment.order_id == order_id, Payment.status.in_(["SUCCESS", "DONE"]))
                .first()
            )
            if dup:
                continue

            # TODO: 실제 토스 Billing API 결제 호출부
            # 성공 가정 응답
            gateway_result = {
                "status": "SUCCESS",
                "method": "CARD",
                "transactionKey": f"tr_{order_id}",
                "approvedAt": datetime.now(UTC).isoformat(),
            }
            if gateway_result["status"] != "SUCCESS":
                raise RuntimeError("Gateway failed")

            # 결제 레코드
            pay = Payment(
                user_id=sub.user_id,
                subscription_id=sub.id,
                order_id=order_id,
                amount=amount,
                method=gateway_result.get("method", ""),
                status="SUCCESS",
                transaction_key=gateway_result.get("transactionKey", ""),
                approved_at=gateway_result.get("approvedAt"),
                raw_response=gateway_result,
            )
            db.add(pay)

            # 기간 연장
            new_start = sub.end_date or today
            new_end = new_start + timedelta(days=sub.plan.duration_days)
            sub.start_date = new_start
            sub.end_date = new_end
            sub.next_renew_on = new_end

            # 사용량 리셋/증설
            recording_usage_crud.create_or_update_usage(db, sub.user_id, sub)

            db.commit()
            success += 1

        except Exception as e:
            db.rollback()
            failed += 1
            # 간단 재시도 정책: 다음날로 미룸(여기서 지수백오프/카운트정책 가능)
            sub.next_renew_on = (sub.next_renew_on or today) + timedelta(days=1)
            db.commit()
            print(f"[AutoRenew] Failed sub#{sub.id}: {e}")

    print(f"[AutoRenew] processed={processed}, success={success}, failed={failed}")

def start_scheduler():
    """스케줄러 실행 (만료: 01:00, 자동결제: 03:00)"""
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler

    _scheduler = AsyncIOScheduler(timezone="Asia/Seoul")
    _scheduler.add_job(expire_subscriptions, CronTrigger(hour=1, minute=0))
    _scheduler.add_job(renew_due_subscriptions, CronTrigger(hour=3, minute=0))
    _scheduler.add_job(
        send_morning_calendar_notifications,
        CronTrigger(hour=8, minute=0, timezone=KST),
        id="calendar_morning_notifications",
        replace_existing=True,
    )
    _scheduler.start()
    print("[Scheduler] Started: expire@01:00, renew@03:00")
    return _scheduler

async def run_renew_once():
    """서버 기동 직후 1회 실행하고 싶을 때 호출 (선택)."""
    # 스케줄러 잡과 동일하게 세션 열고 닫음
    renew_due_subscriptions()

try:
    from backend.app.model import UserBanLog  # 로그 테이블 쓰는 경우
except Exception:
    UserBanLog = None

@_with_session
def unban_expired_users(db: Session):
    """
    banned_until <= now 인 유저의 밴을 자동 해제.
    - is_banned=False, banned_reason=None, banned_until=None 로 리셋
    - (선택) UserBanLog 에도 해제 이력 기록
    """
    now = datetime.now(UTC)

    targets = (
        db.query(User)
        .filter(
            User.is_banned == True,
            User.banned_until.isnot(None),
            User.banned_until <= now,
        )
        .all()
    )
    if not targets:
        return

    for u in targets:
        u.is_banned = False
        u.banned_reason = None
        u.banned_until = None
        db.add(u)

        # 선택: 해제 로그 남기기
        if UserBanLog is not None:
            db.add(UserBanLog(
                user_id=u.id,
                actor_id=None,          # 시스템 자동 해제
                is_banned=False,
                reason=None,
                until=None,
            ))

    db.commit()

def _today_range_kst():
    now = datetime.now(KST)
    start = datetime.combine(now.date(), time(0, 0, 0), tzinfo=KST)
    end   = start + timedelta(days=1)
    return start, end

@_with_session
def send_morning_calendar_notifications(db: Session):
    """당일(로컬 KST) 일정들을 유저별로 모아 아침 알림 생성"""
    day_start, day_end = _today_range_kst()

    # remind_morning 컬럼이 있다면 조건 포함
    q = (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.start_time >= day_start,
            CalendarEvent.start_time < day_end,
            # CalendarEvent.remind_morning == True,   # ← 컬럼 쓴다면 주석 해제
        )
    )

    events = q.all()
    if not events:
        return

    # 유저별 그룹핑
    by_user = {}
    for ev in events:
        by_user.setdefault(ev.user_id, []).append(ev)

    for user_id, user_events in by_user.items():
        # 중복 방지: 오늘 이미 보낸 적 있으면 skip
        already = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.type == "calendar_morning",
                Notification.created_at >= day_start,
                Notification.created_at < day_end,
            )
            .first()
        )
        if already:
            continue

        # 내용 만들기 (최대 5개만 상세, 나머지는 +N)
        def fmt(dt: datetime):
            # 사용자별 타임존이 있다면 그걸로 변환 (User.calendar.timezone 사용 가능)
            local = dt.astimezone(KST)
            return local.strftime("%H:%M")

        items = [
            f"• {ev.title}" + ("" if ev.all_day else f" ({fmt(ev.start_time)})")
            for ev in sorted(user_events, key=lambda e: e.start_time)
        ]
        preview = "\n".join(items[:5])
        if len(items) > 5:
            preview += f"\n…외 {len(items)-5}건"

        content = f"오늘 일정 {len(user_events)}건\n{preview}"

        noti = Notification(
            user_id=user_id,
            type="calendar_morning",
            content=content,
            is_read=False,
            created_at=datetime.now(KST),
        )
        db.add(noti)

    db.commit()