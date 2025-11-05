from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.db import get_db
from backend.app.model import Notification
from backend.app.deps.auth import get_current_user # 실제 프로젝트 인증 의존성 사용
from backend.app.crud import notification_crud
from backend.app.schemas.notification_schema import NotificationsDeleteRequest
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

@router.get("/", response_model=list[dict], summary="알림 가져오기")
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

@router.get("/unread", response_model=list[dict], summary="읽지 않은 알림 가져오기")
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

@router.post("/{noti_id}/read", response_model=dict, summary="알림 읽기")
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

@router.post("/read-all", response_model=dict, summary="모든 알람 읽기")
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

@router.post("/trigger-morning", summary="테스트 용")
def trigger_morning(current_user=Depends(get_current_user)):
    # if not current_user.is_admin: raise HTTPException(403, "forbidden")
    send_morning_calendar_notifications()   # 바로 실행
    return {"ok": True}

@router.delete("/{notification_id}", status_code=204, summary="알람 삭제")
def delete_one_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    ok = notification_crud.delete_notification(
        db, user_id=current_user.id, notification_id=notification_id
    )
    if not ok:
        raise HTTPException(status_code=404, detail="NOTIFICATION_NOT_FOUND")
    return  # 204

@router.delete("", status_code=200, summary="알람 다중 삭제")
def delete_many_notifications(
    payload: NotificationsDeleteRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    # ✅ 빈 선택 방지
    if not payload.ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NO_SELECTION: 삭제할 항목이 없습니다."
        )

    deleted = notification_crud.delete_notifications_by_ids(
        db, user_id=current_user.id, ids=payload.ids
    )
    # 선택은 있었지만 권한/존재 문제로 실제 삭제 0건인 경우
    if deleted == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NOTIFICATIONS_NOT_FOUND_OR_FORBIDDEN"
        )
    return {"deleted": deleted}

@router.delete("/all", status_code=200, summary="모든 알람 삭제")
def clear_all_notifications(
    older_than: Optional[datetime] = Query(None, description="이 시각보다 이전 알림만 삭제"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    deleted = notification_crud.clear_notifications(
        db, user_id=current_user.id, older_than=older_than
    )
    return {"deleted": deleted}