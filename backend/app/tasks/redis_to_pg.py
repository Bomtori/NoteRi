# backend/app/tasks/redis_to_pg.py

import sys
import os
from datetime import datetime
from typing import Optional
import json
from dotenv import load_dotenv

# SQLAlchemy async 임포트
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# ✅ Redis async 임포트 수정!
import redis.asyncio as aioredis

# 환경변수 로드
load_dotenv()

# 필요한 경우 config에서 가져오기
try:
    from backend.config import REDIS_URL, DATABASE_URL
except ImportError:
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    DATABASE_URL = os.getenv("DATABASE_URL")

from backend.app.util.crypto_path import encrypt_path

# ✅ Models 임포트
from backend.app.model import (
    RecordingSession, 
    RecordingResult, 
    AudioData,
    FinalSummary,
    Board
)

# ✅ Async 엔진 및 세션 팩토리 생성
engine = create_async_engine(
    DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
    echo=False
)
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_redis_client():
    """Redis 클라이언트 생성"""
    return await aioredis.from_url(REDIS_URL, decode_responses=True)


def resolve_board_id(meta):
    """메타에서 board_id 추출"""
    val = meta.get("board_id")
    if val is None:
        raise RuntimeError("board_id missing in meta")
    return int(val)


async def resolve_user_id(meta, db: AsyncSession, board_id: int):
    """메타에서 user_id 추출 또는 board owner_id 사용"""
    val = meta.get("user_id")
    if val is not None:
        return int(val)
    
    # ✅ board.owner_id 사용
    result = await db.execute(
        select(Board.owner_id).where(Board.id == board_id)
    )
    owner_id = result.scalar_one_or_none()
    
    if not owner_id:
        raise RuntimeError("user_id missing and board owner not found")
    return int(owner_id)


def _keys(prefix: str, sid: str):
    """Redis 키 생성"""
    return {
        "meta": f"{prefix}:meta:{sid}",
        "lines": f"{prefix}:lines:{sid}",
        "summaries": f"{prefix}:summaries:{sid}",
        "audio": f"{prefix}:audio:{sid}"
    }


async def ingest_session_to_db(
    sid: str, 
    prefix: Optional[str] = None,
    db: Optional[AsyncSession] = None
):
    """
    Redis → PostgreSQL 이관 (Async 버전)
    
    Args:
        sid: 세션 ID
        prefix: Redis 키 프리픽스 (None이면 자동 생성)
        db: AsyncSession (None이면 새로 생성)
        
    Returns:
        int: recording_sessions.id
    """
    should_close_db = False
    should_close_redis = True
    
    # ✅ DB 세션 생성
    if db is None:
        db = AsyncSessionLocal()
        should_close_db = True
    
    # ✅ Redis 클라이언트 생성
    redis_client = await get_redis_client()
    
    try:
        # prefix 자동 생성
        if prefix is None:
            prefix = datetime.now().strftime("stt:%Y-%m-%d")
        
        keys = _keys(prefix, sid)
        
        # ✅ 멱등성 체크: 이미 적재된 세션인지 확인
        cached_key = f"{prefix}:ingested:{sid}"
        cached = await redis_client.get(cached_key)
        if cached:
            print(f"[INFO] Session {sid} already ingested")
            return int(cached)
        
        # ✅ 메타 데이터 조회
        meta_json = await redis_client.get(keys["meta"])
        if not meta_json:
            raise RuntimeError(f"Meta not found for sid={sid} (key={keys['meta']})")
        
        meta = json.loads(meta_json)
        
        # board_id, user_id 확인
        board_id = resolve_board_id(meta)
        user_id = await resolve_user_id(meta, db, board_id)
        
        # 타임스탬프 추출
        started_at = datetime.fromtimestamp(meta.get("session_start_ts", 0))
        ended_at = datetime.fromtimestamp(meta.get("session_end_ts", 0)) if meta.get("session_end_ts") else datetime.now()
        
        # ✅ 1. RecordingSession 생성
        recording_session = RecordingSession(
            id=int(sid),
            board_id=board_id,
            user_id=user_id,
            status="completed",
            started_at=started_at,
            ended_at=ended_at,
            is_diarized=False
        )
        
        db.add(recording_session)
        await db.flush()  # ✅ ID 즉시 생성
        
        print(f"[OK] RecordingSession created: id={recording_session.id}")
        
        # ✅ 2. Transcriptions 생성
        lines_json = await redis_client.lrange(keys["lines"], 0, -1)
        
        inserted_results = 0
        for idx, line_str in enumerate(lines_json):
            try:
                line = json.loads(line_str)
                
                # ✅ RecordingResult 객체 생성
                result = RecordingResult(
                    recording_session_id=recording_session.id,
                    speaker_label=line.get("speaker", "SPEAKER_00"),
                    raw_text=line.get("text", ""),
                    started_at=datetime.fromtimestamp(line.get("start_time", 0)) if line.get("start_time") else None,
                    ended_at=datetime.fromtimestamp(line.get("end_time", 0)) if line.get("end_time") else None
                )
                
                db.add(result)
                inserted_results += 1
            except Exception as e:
                print(f"[WARN] Failed to parse line {idx}: {e}")
                continue
        
        print(f"[OK] RecordingResults inserted: {inserted_results}")
        
        # ✅ 3. AudioData 생성
        audio_path = meta.get("audio_path")
        if audio_path:
            try:
                cipher_path = encrypt_path(audio_path)
            except Exception as e:
                print(f"[WARN] Failed to encrypt path: {e}")
                cipher_path = audio_path
            
            duration = meta.get("duration_sec")
            language = meta.get("language", "ko")
            
            audio_data = AudioData(
                board_id=board_id,
                recording_session_id=recording_session.id,
                file_path=cipher_path,
                duration=duration,
                language=language
            )
            
            db.add(audio_data)
            print(f"[OK] AudioData inserted: {audio_path}")
        
        # ✅ 4. 커밋
        await db.commit()
        print(f"[SUCCESS] Session {sid} ingested successfully")
        
        # ✅ 5. 멱등성 캐시 설정 (7일)
        await redis_client.setex(cached_key, 7 * 24 * 3600, str(recording_session.id))
        
        # ✅ 6. Redis 키 TTL 설정 (24시간 보존)
        ttl = 24 * 3600
        for key in keys.values():
            try:
                await redis_client.expire(key, ttl)
            except Exception:
                pass
        
        return recording_session.id
        
    except Exception as e:
        await db.rollback()  # ✅ 에러 시 롤백
        print(f"[ERROR] Failed to ingest {sid}: {e}")
        import traceback
        traceback.print_exc()
        raise
        
    finally:
        # ✅ 리소스 정리
        if should_close_redis:
            await redis_client.close()
        
        if should_close_db:
            await db.close()


async def ingest_all_for_prefix(prefix: str):
    """
    같은 날짜(prefix)의 모든 sid를 찾아 순회 적재
    """
    redis_client = await get_redis_client()
    
    try:
        # sids 세트에서 모든 세션 ID 가져오기
        sids_key = f"{prefix}:sids"
        sids = await redis_client.smembers(sids_key)
        
        if not sids:
            print(f"[INFO] No sessions found for prefix: {prefix}")
            return
        
        print(f"[INFO] Found {len(sids)} sessions for prefix: {prefix}")
        
        for sid in sorted(sids):
            try:
                await ingest_session_to_db(sid, prefix)
            except Exception as e:
                print(f"[ERROR] Failed to ingest {sid}: {e}")
                continue
                
    finally:
        await redis_client.close()


# ✅ CLI 실행을 위한 동기 래퍼
def sync_ingest_one(sid: str, prefix: str):
    """동기 버전 (CLI용)"""
    import asyncio
    asyncio.run(ingest_session_to_db(sid, prefix))


def sync_ingest_all(prefix: str):
    """동기 버전 (CLI용)"""
    import asyncio
    asyncio.run(ingest_all_for_prefix(prefix))


if __name__ == "__main__":
    # CLI 사용:
    # 1) 한 세션:  python backend/app/tasks/redis_to_pg.py <sid> stt:YYYY-MM-DD
    # 2) 하루 전체: python backend/app/tasks/redis_to_pg.py --all stt:YYYY-MM-DD
    if len(sys.argv) < 2:
        print("Usage: python backend/app/tasks/redis_to_pg.py <sid> <stt:YYYY-MM-DD>")
        print("   or: python backend/app/tasks/redis_to_pg.py --all <stt:YYYY-MM-DD>")
        sys.exit(1)
    
    if sys.argv[1] == "--all":
        if len(sys.argv) < 3:
            print("Missing prefix for --all")
            sys.exit(1)
        prefix = sys.argv[2]
        sync_ingest_all(prefix)
    else:
        if len(sys.argv) < 3:
            print("Missing prefix")
            sys.exit(1)
        sid = sys.argv[1]
        prefix = sys.argv[2]
        sync_ingest_one(sid, prefix)