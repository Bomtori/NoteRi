from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.db import get_db
from backend.app.model import Notification
from backend.app.deps.auth import get_current_user # 실제 프로젝트 인증 의존성 사용
from backend.app.tasks.scheduler import send_morning_calendar_notifications

router = APIRouter(prefix="/notifications", tags=["notifications"]) # /api 쓰면 main에서 prefix 추가
KST = ZoneInfo("Asia/Seoul")

def _row_to_dict(n: Notification) -> dict:
    return {
    "id": n.id,
    "type": n.type,
    "content": n.content,
    "is_read": bool(n.is_read),
    "created_at": n.created_at,
    }

@router.get("/", response_model=list[dict])
def list_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    unread: Optional[bool] = None,
    limit: int = 50,
):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread is True:
        q = q.filter(Notification.is_read == False)
    elif unread is False:
        q = q.filter(Notification.is_read == True)


    rows = q.order_by(Notification.created_at.desc()).limit(limit).all()
    return [_row_to_dict(n) for n in rows]




@router.get("/unread", response_model=list[dict])
def list_unread(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = (
    db.query(Notification)
    .filter(Notification.user_id == current_user.id, Notification.is_read == False)
    .order_by(Notification.created_at.desc())
    .all()
    )
    return [_row_to_dict(n) for n in rows]




@router.post("/{noti_id}/read", response_model=dict)
def mark_read(
noti_id: int,
db: Session = Depends(get_db),
current_user=Depends(get_current_user),
):
    n = (
    db.query(Notification)
    .filter(Notification.id == noti_id, Notification.user_id == current_user.id)
    .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"ok": True}




@router.post("/read-all", response_model=dict)
def mark_all_read(
db: Session = Depends(get_db),
current_user=Depends(get_current_user),
):
    (
    db.query(Notification)
    .filter(Notification.user_id == current_user.id, Notification.is_read == False)
    .update({Notification.is_read: True})
    )
    db.commit()
    return {"ok": True}
@router.post("/trigger-morning")
def trigger_morning(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # 1) 스케줄러 함수 실행
    send_morning_calendar_notifications()  # 필요 시 인자(db, user_id) 넘기도록 수정

    # 2) 디버그: 최소 1건은 보장하게 샘플 알림 생성
    sample = Notification(
        user_id=current_user.id,
        type="calendar",
        content="(테스트) 아침 알림 트리거가 실행되었습니다.",
        is_read=False,
    )
    db.add(sample)
    db.commit()
    return {"ok": True}