# backend/app/routers/redis_test_router.py
from fastapi import APIRouter
from pydantic import BaseModel
from ..util.redis_client import get_redis

router = APIRouter(prefix="/redis", tags=["redis"])

@router.get("/health")
async def health():
    r = await get_redis()
    pong = await r.ping()
    return {"redis": "ok" if pong else "ng"}

class LiveIn(BaseModel):
    sid: str
    text: str
    speaker: str = "Unknown"

@router.post("/live")
async def set_live(data: LiveIn):
    """
    실시간 partial: 최신값을 10초 TTL로 저장
    """
    r = await get_redis()
    key = f"mlog:session:{data.sid}:live"
    await r.set(key, data.model_dump_json(), ex=10)
    return {"ok": True, "key": key}

@router.get("/live/{sid}")
async def get_live(sid: str):
    r = await get_redis()
    key = f"mlog:session:{sid}:live"
    val = await r.get(key)
    return {"key": key, "value": val}
