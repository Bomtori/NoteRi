from typing import List, Tuple, Optional
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from backend.app.model import Plan, Subscription

def get_subscription_count_by_plan(
    db: Session,
    *,
    as_of: Optional[date] = None,
    active_only: bool = True,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[Tuple[str, int]]:
    """
    플랜별 유저 수(중복 사용자 제외) 집계
    - 기본: is_active=True 인 구독만 집계
    - as_of 지정 시: 해당 날짜에 '효력 있는' 구독(start<=as_of<=end)만 집계
    - date_from/date_to 지정 시: Subscription.start_date 구간으로 제한
    - 항상 '사용자 수'는 DISTINCT(user_id)로 계산 (중복 구독 방지)
    - 모든 플랜을 기준(LEFT OUTER JOIN)으로 0건도 포함
    """
    q = (
        db.query(
            Plan.name.label("plan_enum"),
            func.count(func.distinct(Subscription.user_id)).label("user_count"),
        )
        .outerjoin(Subscription, Subscription.plan_id == Plan.id)
    )

    conditions = []

    # 날짜 기준 활성 판단
    if as_of is not None:
        conditions.append(Subscription.start_date <= as_of)
        # end_date가 NULL(무기한) 이거나, as_of 이전이면 활성
        conditions.append(
            or_(Subscription.end_date == None, Subscription.end_date >= as_of)  # noqa: E711
        )

    # active_only 플래그
    if active_only:
        conditions.append(Subscription.is_active == True)  # noqa: E712

    # 구간 필터 (start_date 기준)
    if date_from is not None:
        conditions.append(Subscription.start_date >= date_from)
    if date_to is not None:
        conditions.append(Subscription.start_date <= date_to)

    if conditions:
        q = q.filter(and_(*conditions))

    q = q.group_by(Plan.id, Plan.name).order_by(Plan.id)

    rows = q.all()

    # Plan.name이 Enum(PlanType) 이면 .value 로 문자열화
    result: List[Tuple[str, int]] = []
    for plan_enum, cnt in rows:
        if hasattr(plan_enum, "value"):
            result.append((plan_enum.value, cnt))
        else:
            result.append((str(plan_enum), cnt))

    return result