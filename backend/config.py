# config.py

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# === Summarizer 관련 설정 ===
# 더이상 사용하지 않음
# SUMMARIZER_PROMPT = "요약 후 문맥에 맞게 수정\n"
# SUMMARIZER_MAX_LENGTH = 100
# SUMMARIZER_MIN_LENGTH = 30

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
    port = os.getenv("POSTGRES_PORT", "5433")
    db   = os.getenv("POSTGRES_DB", "mydb")
    DATABASE_URL = f"postgresql://{user}:{pwd}@{host}:{port}/{db}"

DEFAULT_BOARD_ID = os.getenv("DEFAULT_BOARD_ID")
DEFAULT_USER_ID  = os.getenv("DEFAULT_USER_ID")

def resolve_board_id(meta: dict | None) -> int | None:
    """meta에 board_id/boardId 있으면 사용, 없으면 None"""
    if meta:
        v = meta.get("board_id") or meta.get("boardId")
        if v is not None and str(v).strip() != "":
            try:
                return int(v)
            except Exception:
                pass
    # 기본값 제거
    return int(DEFAULT_BOARD_ID) if DEFAULT_BOARD_ID else None


def resolve_user_id(meta: dict | None) -> int | None:
    """meta에 user_id/userId 있으면 사용, 없으면 None"""
    if meta:
        v = meta.get("user_id") or meta.get("userId")
        if v is not None and str(v).strip() != "":
            try:
                return int(v)
            except Exception:
                pass
    # 기본값 제거
    return int(DEFAULT_USER_ID) if DEFAULT_USER_ID else None

import os
from urllib.parse import quote_plus

# Ollama 기본 설정
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct-q4_K_M")

# 안정성 옵션
OLLAMA_MAX_LOADED_MODELS = os.getenv("OLLAMA_MAX_LOADED_MODELS", "1")
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "5m")
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "300"))
OLLAMA_STREAM = os.getenv("OLLAMA_STREAM", "false").lower() == "true"

# 요청 시 사용할 옵션
OLLAMA_DEFAULT_OPTIONS = {
    "num_ctx": int(os.getenv("OLLAMA_OPTIONS_NUM_CTX", "8192")),
    "temperature": float(os.getenv("OLLAMA_OPTIONS_TEMPERATURE", "0.7")),
    "top_p": float(os.getenv("OLLAMA_OPTIONS_TOP_P", "0.9")),
    "keep_alive": OLLAMA_KEEP_ALIVE,
}