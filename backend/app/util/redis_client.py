# backend/app/util/redis_client.py

from redis import asyncio as aioredis
import os

_redis: aioredis.Redis | None = None

def _url() -> str:
    # backend/.env에 REDIS_URL=redis://default:1234@localhost:6379/0
    return os.getenv("REDIS_URL", "redis://localhost:6379/0")

async def get_redis() -> aioredis.Redis:
    """Lazy singleton 연결"""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            _url(),
            decode_responses=True,
            health_check_interval=30,
        )
    return _redis

async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.close()
        _redis = None