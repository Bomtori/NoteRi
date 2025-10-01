from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from datetime import date
from app.db import SessionLocal
from app.model import Subscription, PlanType


def expire_subscriptions():
    """만료된 구독을 free로 전환하는 작업"""
    db: Session = SessionLocal()
    try:
        expired = db.query(Subscription).filter(
            Subscription.end_date < date.today(),
            Subscription.is_active is True
        ).all()

        for sub in expired:
            sub.plan = PlanType.free
            sub.is_active = False

        if expired:
            db.commit()
            print(f"[Scheduler] {len(expired)} subscriptions expired and set to free.")
    except Exception as e:
        print(f"[Scheduler Error] {e}")
    finally:
        db.close()


def start_scheduler():
    """스케줄러 실행 (매일 새벽 1시)"""
    scheduler = BackgroundScheduler(timezone="Asia/Seoul")
    scheduler.add_job(expire_subscriptions, "cron", hour=1, minute=0)
    scheduler.start()
    print("[Scheduler] Started subscription expiration job.")