# plan_crud.py
from typing import List, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from backend.app.model import Plan
from backend.app.schemas.plan_schema import PlanCreate, PlanUpdate

def get_plan_by_id(db: Session, plan_id: int) -> Optional[Plan]:
    return db.query(Plan).filter(Plan.id == plan_id).first()

def get_plan_by_name(db: Session, name: str) -> Optional[Plan]:
    return db.query(Plan).filter(Plan.name == name).first()

def list_plans(db: Session) -> List[Plan]:
    return db.query(Plan).order_by(Plan.id.asc()).all()

def create_plan(db: Session, payload: PlanCreate) -> Plan:
    plan = Plan(
        name=payload.name,  # 문자열 그대로
        price=payload.price,
        duration_days=payload.duration_days,
        allocated_seconds=payload.allocated_seconds,
        description=payload.description,
    )
    db.add(plan)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 존재하는 Plan name 입니다."
        )
    db.refresh(plan)
    return plan

def update_plan_price(db: Session, plan_id: int, price: Decimal) -> Plan:
    plan = get_plan_by_id(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan을 찾을 수 없습니다.")
    plan.price = price
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

def update_plan(db: Session, plan_id: int, payload: PlanUpdate) -> Plan:
    plan = get_plan_by_id(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan을 찾을 수 없습니다.")
    if payload.price is not None:
        plan.price = payload.price
    if payload.duration_days is not None:
        plan.duration_days = payload.duration_days
    if payload.allocated_seconds is not None:
        plan.allocated_seconds = payload.allocated_seconds
    if payload.description is not None:
        plan.description = payload.description
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

def delete_plan(db: Session, plan_id: int) -> None:
    plan = get_plan_by_id(db, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan을 찾을 수 없습니다.")
    db.delete(plan)
    db.commit()
