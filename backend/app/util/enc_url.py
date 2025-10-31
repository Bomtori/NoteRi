import json, os, time
from typing import Any, Dict
from cryptography.fernet import Fernet, InvalidToken

FERNET_KEY = os.getenv("FERNET_KEY")
if not FERNET_KEY:
    raise RuntimeError("FERNET_KEY is not set")
fernet = Fernet(FERNET_KEY)

def make_link_token(payload: Dict[str, Any], ttl_seconds: int | None = None) -> str:
    """
    payload 예: {"bid": 123, "role": "viewer", "iat": 1730340000, "exp": 1730944800}
    exp은 여기서 직접 넣어도 되고, 바깥에서 계산해 넣어도 됩니다.
    """
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return fernet.encrypt(raw).decode("utf-8")  # URL-safe

def parse_link_token(token: str) -> Dict[str, Any]:
    try:
        raw = fernet.decrypt(token.encode("utf-8"))
        data = json.loads(raw.decode("utf-8"))
    except InvalidToken:
        raise ValueError("invalid token")

    # 만료 검사(exp 있으면)
    exp = data.get("exp")
    if isinstance(exp, (int, float)) and time.time() > float(exp):
        raise ValueError("expired token")
    return data
