from dataclasses import dataclass
from typing import Optional
import os, time
from fastapi import Query, HTTPException
from backend.app.util.enc_url import parse_link_token

DEFAULT_TTL = int(os.getenv("LINK_TOKEN_TTL_SECONDS", "0"))  

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
