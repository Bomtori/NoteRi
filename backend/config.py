# config.py

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# === Summarizer 관련 설정 ===
SUMMARIZER_PROMPT = "요약 후 문맥에 맞게 수정\n"
SUMMARIZER_MAX_LENGTH = 100
SUMMARIZER_MIN_LENGTH = 30

# === VAD 관련 설정 ===
VAD_THRESHOLD = 0.35   # 음성 감지 민감도 (낮출수록 더 민감)
VAD_SAMPLE_RATE = 16000


# === Redis / Postgres / Defaults ===
# redis_to_pg.py 등에서 import 하여 공통으로 사용
REDIS_URL = os.getenv("REDIS_URL")
if not REDIS_URL:
    host = os.getenv("REDIS_HOST", "localhost")
    port = os.getenv("REDIS_PORT", "6379")
    db   = os.getenv("REDIS_DB", "0")
    pw   = os.getenv("REDIS_PASSWORD")
    user = os.getenv("REDIS_USER", "default")
    if pw:
        REDIS_URL = f"redis://{user}:{pw}@{host}:{port}/{db}"
    else:
        REDIS_URL = f"redis://{host}:{port}/{db}"

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    user = os.getenv("POSTGRES_USER", "postgres")
    pwd  = os.getenv("POSTGRES_PASSWORD", "1234")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db   = os.getenv("POSTGRES_DB", "mydb")
    DATABASE_URL = f"postgresql://{user}:{pwd}@{host}:{port}/{db}"

DEFAULT_BOARD_ID = int(os.getenv("DEFAULT_BOARD_ID", "1"))
DEFAULT_USER_ID  = int(os.getenv("DEFAULT_USER_ID", "1"))

def resolve_board_id(meta: dict | None) -> int:
    """
    meta에 board_id/boardId가 있으면 우선 사용, 없으면 DEFAULT_BOARD_ID 반환
    """
    if meta:
        v = meta.get("board_id") or meta.get("boardId")
        if v is not None and str(v).strip() != "":
            try:
                return int(v)
            except Exception:
                pass
    return DEFAULT_BOARD_ID


# === user_id 기본값 결정 ===
def resolve_user_id(meta: dict | None) -> int:
    """
    meta에 user_id/userId가 있으면 우선 사용, 없으면 DEFAULT_USER_ID 반환
    """
    if meta:
        v = meta.get("user_id") or meta.get("userId")
        if v is not None and str(v).strip() != "":
            try:
                return int(v)
            except Exception:
                pass
    return DEFAULT_USER_ID