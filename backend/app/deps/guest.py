# backend/app/deps/guest.py
import os
import jwt
import logging
from dataclasses import dataclass
from typing import Optional, Literal

from fastapi import Depends, Header, Cookie, Request
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.model import User
from backend.app.deps.auth import get_current_user_optional

logger = logging.getLogger("uvicorn")

GUEST_SECRET_KEY = os.getenv("GUEST_SECRET_KEY")
JWT_ALG = "HS256"


@dataclass
class Principal:
    type: Literal["user", "guest"]
    user: Optional[User] = None
    board_id: Optional[int] = None

    @property
    def is_user(self) -> bool:
        return self.type == "user"

    @property
    def is_guest(self) -> bool:
        return self.type == "guest"


def get_principal(
    request: Request,
    db: Session = Depends(get_db),
    authorization: str = Header(None),
    guest_header: Optional[str] = Header(None, alias="X-Guest-Token"),
    guest_token_cookie: Optional[str] = Cookie(None, alias="guest_token"),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> Optional[Principal]:
    # 1) 로그인 유저면 바로 user principal
    if current_user is not None:
        logger.info(f"👤 principal=user id={current_user.id}")
        return Principal(type="user", user=current_user)

    token: Optional[str] = None

    # 2) 프론트에서 직접 보내는 X-Guest-Token 헤더 우선
    if guest_header:
        token = guest_header
        logger.info("📨 guest: X-Guest-Token 헤더로 수신")

    # 3) (선택) Authorization: Bearer <guest_token> 형태를 쓰고 싶다면
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
        logger.info("🎫 guest: Authorization Bearer 로 guest_token 수신")

    # 4) (백업) 쿠키
    elif "guest_token" in request.cookies:
        token = request.cookies.get("guest_token")
        logger.info("🍪 guest: request.cookies 에서 guest_token 수신")
    elif guest_token_cookie:
        token = guest_token_cookie
        logger.info("🍪 guest: Cookie() 파라미터에서 guest_token 수신")

    if not token:
        logger.warning("🚫 guest 토큰 없음")
        return None

    if not GUEST_SECRET_KEY:
        logger.error("GUEST_SECRET_KEY 미설정")
        return None

    try:
        payload = jwt.decode(token, GUEST_SECRET_KEY, algorithms=[JWT_ALG])
        logger.info(f"✅ guest_token 해독 성공: {payload}")
    except Exception as e:
        logger.warning(f"❌ guest_token 해독 실패: {e}")
        return None

    if not payload.get("guest"):
        logger.warning("❌ guest_token 이지만 guest 플래그 없음")
        return None

    bid = payload.get("board_id")
    try:
        bid = int(bid)
    except Exception:
        logger.warning(f"❌ guest_token board_id 형식 오류: {payload.get('board_id')}")
        return None

    return Principal(type="guest", board_id=bid)
