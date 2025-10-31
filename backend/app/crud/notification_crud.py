from sqlalchemy.orm import Session
from typing import Iterable, Optional
from datetime import datetime
from backend.app.model import Notification

def delete_notification(db: Session, *, user_id: int, notification_id: int) -> bool:
    q = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id,
    )
    obj = q.first()
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True

def delete_notifications_by_ids(db: Session, *, user_id: int, ids: Iterable[int]) -> int:
    ids = list(set(int(i) for i in ids if i is not None))
    if not ids:
        return 0
    q = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.id.in_(ids),
    )
    count = q.count()
    if count:
        q.delete(synchronize_session=False)
        db.commit()
    return count

def clear_notifications(
    db: Session,
    *,
    user_id: int,
    older_than: Optional[datetime] = None,
) -> int:
    q = db.query(Notification).filter(Notification.user_id == user_id)
    if older_than:
        q = q.filter(Notification.created_at < older_than)
    count = q.count()
    if count:
        q.delete(synchronize_session=False)
        db.commit()
    return count
