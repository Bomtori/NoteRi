# backend/app/util/crypto_path.py
from dotenv import load_dotenv
import pathlib

# 현재 backend 경로 기준으로 .env 탐색
env_path = pathlib.Path(__file__).resolve().parents[2] / ".env"
if env_path.exists():
    load_dotenv(env_path)

import os
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

_KEY = os.getenv("AUDIO_PATH_KEY")
if not _KEY:
    raise RuntimeError("AUDIO_PATH_KEY is missing in environment")

_fernet = Fernet(_KEY.encode() if isinstance(_KEY, str) else _KEY)

def encrypt_path(plain_path: str) -> str:
    if plain_path is None:
        return None
    token = _fernet.encrypt(plain_path.encode("utf-8"))
    return token.decode("utf-8")

def decrypt_path(token: str) -> Optional[str]:
    if token is None:
        return None
    try:
        return _fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception):
        # 키 교체 이전 데이터/평문이 섞여 있을 수 있으니 안전하게 None 반환
        return None