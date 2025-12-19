from datetime import timedelta
from typing import Iterable, Sequence
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from backend.app.model import CalendarEvent

class NotFound(Exception): ...
class Forbidden(Exception): ...

def _normalize_all_day(start, end, all_day: bool):
    """
    all_day일 때 end가 없으면 start+1일로 보정 (FullCalendar 일반 패턴).
    """
    if all_day and end is None:
        return start, start + timedelta(days=1)
    return start, end

def list_events(db: Session, user_id: int, start, end, board_id: int | None = None) -> Sequence[CalendarEvent]:
    q = db.query(CalendarEvent).filter(
        CalendarEvent.user_id == user_id,
        CalendarEvent.start_time < end,
        or_(CalendarEvent.end_time == None, CalendarEvent.end_time > start),
    )
    if board_id:
        q = q.filter(CalendarEvent.board_id == board_id)
    return q.order_by(CalendarEvent.start_time.asc()).all()

def get_event(db: Session, event_id: int, user_id: int) -> CalendarEvent:
    ev = db.query(CalendarEvent).filter(
        CalendarEvent.id == event_id,
        CalendarEvent.user_id == user_id
    ).first()
    if not ev:
        raise NotFound()
    return ev

def create_event(db: Session, user_id: int, payload) -> CalendarEvent:
    start, end = _normalize_all_day(payload.start_time, payload.end_time, payload.all_day)
    ev = CalendarEvent(
        user_id=user_id,
        board_id=payload.board_id,
        title=payload.title,
        description=payload.description,
        location=payload.location,
        url=str(payload.url) if payload.url else None,
        start_time=start,
        end_time=end,
        all_day=payload.all_day,
        background_color=payload.background_color,
        text_color=payload.text_color,
        border_color=payload.border_color,
        rrule=payload.rrule,
        exdates=payload.exdates,
        extended_props=payload.extended_props,
        created_by=user_id,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev

def update_event(db: Session, event_id: int, user_id: int, payload) -> CalendarEvent:
    ev = get_event(db, event_id, user_id)

    # 부분 업데이트
    for field in [
        "title","description","location","board_id","rrule","exdates",
        "background_color","text_color","border_color","extended_props","url"
    ]:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(ev, field, str(val) if field=="url" and val is not None else val)

    # 시간/종일 처리
    st = payload.start_time if getattr(payload, "start_time", None) is not None else ev.start_time
    en = payload.end_time if getattr(payload, "end_time", None) is not None else ev.end_time
    ad = payload.all_day if getattr(payload, "all_day", None) is not None else ev.all_day
    st, en = _normalize_all_day(st, en, ad)
    ev.start_time, ev.end_time, ev.all_day = st, en, ad

    if getattr(payload, "status", None) is not None:
        ev.status = payload.status

    db.commit()
    db.refresh(ev)
    return ev

def delete_event(db: Session, event_id: int, user_id: int) -> None:
    ev = get_event(db, event_id, user_id)
    db.delete(ev)
    db.commit()