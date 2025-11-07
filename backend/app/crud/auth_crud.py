from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, UTC, date, timedelta
from fastapi.responses import JSONResponse
from fastapi import status, HTTPException

from backend.app.model import User, Subscription, Plan, PlanType, Folder, RecordingUsage  # PlanType 꼭 import
from backend.app.util.errors import OAuthProviderConflict
from backend.app.util.auth import create_access_token, create_refresh_token

def assert_login_allowed(db_user: User, db: Session | None = None) -> None:
    """
    로그인 직전에 호출해서 밴 유저 차단.
    - active ban: 403 차단 + 상세 정보 전달
    - expired ban: 즉시 해제( db 세션이 있으면 DB 반영 ), 없으면 통과만 시킴
    """
    now = datetime.now(UTC)
    if not db_user.is_banned:
        return

    # 만료된 밴이면 바로 해제
    if db_user.banned_until and db_user.banned_until <= now:
        if db is not None:
            db_user.is_banned = False
            db_user.banned_reason = None
            db_user.banned_until = None
            db.add(db_user)
            db.commit()
        return

    # 영구밴 또는 아직 유효한 밴이면 차단
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "error": "banned_account",
            "reason": db_user.banned_reason or "관리자 조치",
            "until": db_user.banned_until.isoformat() if db_user.banned_until else "영구",
        },
    )

def _ensure_free_plan(db: Session) -> Plan:
    free = db.query(Plan).filter(Plan.name == PlanType.free.value).first()
    if free:
        return free
    free = Plan(
        name=PlanType.free.value,
        price=0,
        description="기본 무료 플랜",
        created_at=datetime.now(UTC),
    )
    db.add(free)
    db.commit()
    db.refresh(free)
    return free

def _plan_alloc_seconds(plan: Plan) -> int | None:
    secs = None
    if hasattr(plan, "allocated_seconds") and plan.allocated_seconds is not None:
        secs = int(plan.allocated_seconds)
    elif hasattr(plan, "allocated_minutes") and plan.allocated_minutes is not None:
        secs = int(plan.allocated_minutes) * 60

    if secs is None or secs <= 0:
        return None  # 무제한
    return secs

def _subscription_end_by_plan(plan: Plan, start: date) -> date | None:
    dur = getattr(plan, "duration_days", None)
    if dur is None or int(dur) <= 0:
        return None
    return start + timedelta(days=int(dur))


def _create_default_shared_folder(db: Session, user_id: int) -> None:
    exists = (
        db.query(Folder)
        .filter(Folder.user_id == user_id, Folder.name == "공유받은 회의")
        .first()
    )
    if exists:
        return
    folder = Folder(
        user_id=user_id,
        name="공유받은 회의",
        color="#7E36F9",
    )
    db.add(folder)
    db.commit()

def _grant_free_subscription_and_usage(db: Session, user_id: int) -> None:
    free_plan = _ensure_free_plan(db)

    # 이미 활성 구독 있으면 스킵
    has_active = (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.is_active == True)
        .first()
    )
    if not has_active:
        start = date.today()
        end = _subscription_end_by_plan(free_plan, start)  # None이면 무기한
        sub = Subscription(
            user_id=user_id,
            plan_id=free_plan.id,
            start_date=start,
            end_date=end,
            is_active=True,
            created_at=datetime.now(UTC),
            # next_renew_on 등은 모델에 있으면 사용
            next_renew_on=end,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

        # RecordingUsage 도 Plan 기준으로 부여
        alloc_secs = _plan_alloc_seconds(free_plan)  # None이면 무제한
        usage = RecordingUsage(
            user_id=user_id,
            subscription_id=sub.id if hasattr(RecordingUsage, "subscription_id") else None,
            allocated_seconds=alloc_secs,
            used_seconds=0,
            period_start=start,
            period_end=end,  # 기간형 요금제면 end, 무기한이면 None
            created_at=datetime.now(UTC),
        )
        db.add(usage)
        db.commit()

    # 기본 폴더
    _create_default_shared_folder(db, user_id)

def get_or_create_user(
    db: Session,
    provider: str,
    sub: str,
    email: str,
    name: str,
    nickname: str,
    picture: str,
) -> User:
    # 1) provider+sub
    user = (
        db.query(User)
        .filter(User.oauth_provider == provider, User.oauth_sub == sub)
        .first()
    )
    if user:
        if not user.name: user.name = name
        if not user.nickname: user.nickname = nickname
        if not user.picture: user.picture = picture
        user.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(user)
        return user

    # 2) email로 기존 계정
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        if existing.oauth_provider and existing.oauth_provider != provider:
            raise OAuthProviderConflict({
        "registered_provider": existing.oauth_provider
    })
        existing.oauth_provider = provider
        existing.oauth_sub = sub
        if not existing.name: existing.name = name
        if not existing.nickname: existing.nickname = nickname
        if not existing.picture: existing.picture = picture
        existing.updated_at = datetime.now(UTC)
        db.commit()
        db.refresh(existing)
        return existing

    # 3) 신규 생성 → 무료 플랜 부여 + 기본 폴더
    user = User(
        email=email,
        name=name,
        nickname=nickname,
        picture=picture,
        oauth_provider=provider,
        oauth_sub=sub,
        role="user",
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(user)

    _grant_free_subscription_and_usage(db, user.id)
    return user


def generate_login_response(db_user: User):
    now = datetime.now(UTC)
    if db_user.is_banned and (db_user.banned_until is None or db_user.banned_until > now):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Banned account")

    access_token = create_access_token({"sub": str(db_user.id), "email": db_user.email, "role": db_user.role,})  # 🍒 10.28 frontend 토큰 권한추가
    refresh_token = create_refresh_token({"sub": str(db_user.id), "email": db_user.email, "role": db_user.role,})  # 🍒 10.28 frontend 토큰 권한추가

    response = JSONResponse({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "name": db_user.name,
            "nickname": db_user.nickname,
            "picture": db_user.picture,
            "role": db_user.role, # 🍒 10.28 frontend 토큰 권한추가
        },
    })

    # 쿠키에 저장 (옵션)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # HTTPS일 때 True로
        samesite="lax",
        max_age=60 * 60 * 24 * 14,
    )
    return response