from fastapi import APIRouter, Depends, Query, Path, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date, time, timedelta
from typing import List
from backend.app.db import get_db
from backend.app.schemas.calendar_event_schema import EventCreate, EventUpdate, EventOut
from backend.app.crud import calendar_event_crud
from backend.app.deps.auth import get_current_user  # 프로젝트의 인증 의존성 경로로 수정
from backend.app.model import User  # 실제 경로에 맞게 수정

router = APIRouter(prefix="/calendar", tags=["calendar"])

def _to_event_out(ev) -> EventOut:
    return EventOut(
        id=ev.id,
        title=ev.title,
        start=ev.start_time,
        end=ev.end_time,
        allDay=ev.all_day,
        backgroundColor=ev.background_color,
        textColor=ev.text_color,
        borderColor=ev.border_color,
        url=ev.url,
        extendedProps=ev.extended_props or {},
    )

@router.get("/", response_model=List[EventOut], summary="기간 내 이벤트 조회 (FullCalendar용)")
def list_events(
    start: datetime = Query(..., description="ISO8601"),
    end: datetime = Query(..., description="ISO8601"),
    board_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = calendar_event_crud.list_events(db, current_user.id, start, end, board_id)
    return [_to_event_out(e) for e in events]

@router.post("/", response_model=EventOut, summary="이벤트 생성")
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev = calendar_event_crud.create_event(db, current_user.id, payload)
    return _to_event_out(ev)

@router.patch("/{event_id}", response_model=EventOut, summary="이벤트 수정")
def update_event(
    event_id: int = Path(..., ge=1),
    payload: EventUpdate = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        ev = calendar_event_crud.update_event(db, event_id, current_user.id, payload)
    except calendar_event_crud.NotFound:
        raise HTTPException(status_code=404, detail="Event not found")
    return _to_event_out(ev)

@router.delete("/{event_id}", summary="이벤트 삭제", status_code=204)
def delete_event(
    event_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        calendar_event_crud.delete_event(db, event_id, current_user.id)
    except calendar_event_crud.NotFound:
        raise HTTPException(status_code=404, detail="Event not found")
    return

@router.get("/day", response_model=List[EventOut], summary="특정 날짜의 이벤트 조회")
def list_events_by_day(
    day: date = Query(..., description="YYYY-MM-DD 형식의 날짜"),
    board_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    📅 특정 '하루'에 해당하는 이벤트만 조회

    - /calendar/day?day=2025-11-25
    - /calendar/day?day=2025-11-25&board_id=1
    """

    # 하루의 시작/끝 범위로 변환 (로컬 기준)
    start = datetime.combine(day, time.min)
    end = start + timedelta(days=1)

    events = calendar_event_crud.list_events(db, current_user.id, start, end, board_id)
    return [_to_event_out(e) for e in events]