from typing import Any, Optional
from datetime import datetime
from pydantic import BaseModel, AnyUrl, field_validator, ConfigDict

# 요청용
class EventCreate(BaseModel):
    title: str
    start_time: datetime
    end_time: Optional[datetime] = None
    all_day: bool = False

    description: Optional[str] = None
    location: Optional[str] = None
    url: Optional[AnyUrl] = None

    background_color: Optional[str] = None
    text_color: Optional[str] = None
    border_color: Optional[str] = None

    board_id: Optional[int] = None
    rrule: Optional[str] = None
    exdates: Optional[list[datetime]] = None
    extended_props: Optional[dict[str, Any]] = None

    @field_validator("end_time")
    @classmethod
    def _end_after_start(cls, v, info):
        start = info.data.get("start_time")
        all_day = info.data.get("all_day", False)
        if v and start and (not all_day) and v < start:
            raise ValueError("end_time must be >= start_time")
        return v

class EventUpdate(BaseModel):
    # 부분 업데이트용
    title: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    all_day: Optional[bool] = None

    description: Optional[str] = None
    location: Optional[str] = None
    url: Optional[AnyUrl] = None

    background_color: Optional[str] = None
    text_color: Optional[str] = None
    border_color: Optional[str] = None

    board_id: Optional[int] = None
    status: Optional[str] = None  # confirmed/tentative/cancelled
    rrule: Optional[str] = None
    exdates: Optional[list[datetime]] = None
    extended_props: Optional[dict[str, Any]] = None

# 응답용 (FullCalendar shape: start/end/allDay/…)
class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    start: datetime
    end: datetime | None = None
    allDay: bool

    backgroundColor: str | None = None
    textColor: str | None = None
    borderColor: str | None = None

    url: AnyUrl | None = None
    extendedProps: dict | None = None
