from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.crud import user_crud
from backend.app.db import get_db

router = APIRouter(prefix="/users", tags=["Users"])

# 사용자 숫자 확인
@router.get("/count")
def get_user_count(db: Session = Depends(get_db)):
    total_users = user_crud.get_total_users_count(db)
    return {"total_users": total_users}

# 비활성 사용자 수 확인
@router.get("/count/noactive")
def get_user_count_no_active(db: Session = Depends(get_db)):
    no_active_users = user_crud.get_no_active_users_count(db)
    return {"no_active_users": no_active_users}

# OAuth 구분
@router.get("/count/provider")
def get_user_count_provider(db: Session = Depends(get_db)):
    return user_crud.get_user_count_by_provider(db)

# 오늘 가입자 수
@router.get("/count/signup/today")
def get_signup_today(db: Session = Depends(get_db)):
    return user_crud.get_user_signup_today_stats(db)

# 최근 일주일 가입자 수 추이
@router.get("/count/signup/last-7-days")
def signup_last_7_days(db: Session = Depends(get_db)):
    return user_crud.get_user_signup_last_7_days(db)

# 최근 5주간 가입자 수 추이
@router.get("/count/signup/last-5-weeks")
def signup_last_5_weeks(db: Session = Depends(get_db)):
    return user_crud.get_user_signup_last_5_weeks(db)

# 최근 6개월 간 가입자 수 추이
@router.get("/count/signup/last-6-months")
def signup_last_6_months(db: Session = Depends(get_db)):
    return user_crud.get_user_signup_last_6_months(db)

# 최근 5년간 가입자 수 추이
@router.get("/count/signup/last-5-years")
def signup_last_5_years(db: Session = Depends(get_db)):
    return user_crud.get_user_signup_last_5_years(db)

@router.get("/last-7d")
def last_7d(db: Session = Depends(get_db)):
    return {"total": user_crud.get_last_7d_signups(db)}

@router.get("/last-m")
def last_6m(db: Session = Depends(get_db)):
    print("한 달동안 가입자 수 ", user_crud.get_last_m_signups(db))
    return {"total": user_crud.get_last_m_signups(db)}

@router.get("/last-12m")
def last_12m(db: Session = Depends(get_db)):
    return {"total": user_crud.get_last_12m_signups(db)}

@router.get("/dod")
def dod(db: Session = Depends(get_db)):
    return user_crud.get_dod_signup_growth(db)

@router.get("/wow")
def wow(db: Session = Depends(get_db)):
    return user_crud.get_wow_signup_growth(db)

@router.get("/mom")
def mom(db: Session = Depends(get_db)):
    return user_crud.get_mom_signup_growth(db)

@router.get("/yoy")
def yoy(db: Session = Depends(get_db)):
    return user_crud.get_yoy_signup_growth(db)

@router.get("/away/count")
def get_inactive_stats(db: Session = Depends(get_db)):
    return user_crud.inactive_stats_last_6_months(db)