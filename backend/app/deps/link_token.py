from dataclasses import dataclass
from typing import Optional
import os, time
from fastapi import Query, HTTPException
from backend.app.util.enc_url import parse_link_token

DEFAULT_TTL = int(os.getenv("LINK_TOKEN_TTL_SECONDS", "0"))  # 0이면 exp 강제 X

@dataclass
class LinkContext:
    bid: int
    role: str
    iat: Optional[int] = None
    exp: Optional[int] = None
    raw: Optional[dict] = None

def optional_link_ctx(t: Optional[str] = Query(None, description="URL link token")) -> Optional[LinkContext]:
    if not t:
        return None
    try:
        data = parse_link_token(t)
    except ValueError as e:
        # 토큰이 있으나 잘못된 경우만 401. (없으면 None으로 통과)
        raise HTTPException(status_code=401, detail=str(e))

    bid = data.get("bid")
    if not isinstance(bid, int):
        raise HTTPException(status_code=400, detail="token missing bid")
    role = data.get("role") or "viewer"
    return LinkContext(
        bid=bid,
        role=role,
        iat=data.get("iat"),
        exp=data.get("exp"),
        raw=data,
    )
