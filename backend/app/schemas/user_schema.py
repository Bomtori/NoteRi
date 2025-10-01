from pydantic import BaseModel

class UserUpdate(BaseModel):
    name: str | None = None
    nickname: str | None = None
    picture: str | None = None   # URL 문자열 저장