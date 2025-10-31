from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class NotificationsDeleteRequest(BaseModel):
    ids: List[int] = Field(default_factory=list, description="삭제할 알림 id 목록")

class NotificationsClearQuery(BaseModel):
    older_than: Optional[datetime] = Field(None, description="이 시각보다 이전 알림만 삭제(옵션)")
