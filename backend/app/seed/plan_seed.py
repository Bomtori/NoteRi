# app/seed/plan_seed.py
from sqlalchemy.orm import Session
from backend.app.model import Plan

def seed_plans(db: Session):
    """기본 플랜 데이터가 없을 경우 생성"""
    default_plans = [
        {"name": "free", "price": 0, "duration_days": 36500, "allocated_seconds": 18000, "description": "무료 플랜 (평생 300분)"},
        {"name": "pro", "price": 10000, "duration_days": 30, "allocated_seconds": 30000, "description": "PRO 플랜 (30일 500분)"},
        {"name": "enterprise", "price": 30000, "duration_days": 30, "allocated_seconds": 999999999, "description": "엔터프라이즈 (무제한)"},
    ]

    for plan_data in default_plans:
        existing = db.query(Plan).filter(Plan.name == plan_data["name"]).first()
        if not existing:
            plan = Plan(**plan_data)
            db.add(plan)
    db.commit()
