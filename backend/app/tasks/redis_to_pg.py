# backend/app/tasks/redis_to_pg.py

import sys
import os
from datetime import datetime
import psycopg2
import redis
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# 필요한 경우 config에서 가져오기
try:
    from backend.config import REDIS_URL, resolve_board_id, resolve_user_id
except ImportError:
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    def resolve_board_id(meta): return int(meta.get("board_id", 1))
    def resolve_user_id(meta): return int(meta.get("user_id", 1))

from backend.app.util.crypto_path import encrypt_path


def _redis_client():
    """
    config.REDIS_URL 사용.
    """
    r = redis.from_url(REDIS_URL, decode_responses=True)
    # 즉시 인증/접속 확인
    r.ping()
    return r


def _pg_connect():
    """
    PostgreSQL 5433 포트 연결
    """
    # 환경변수 직접 읽기
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    # DATABASE_URL 파싱 또는 직접 구성
    database_url = os.getenv("DATABASE_URL")
    
    if database_url:
        conn = psycopg2.connect(database_url)
    else:
        # fallback: 직접 구성
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5433")),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "1234"),
            database=os.getenv("POSTGRES_DB", "mydb")
        )
    
    conn.autocommit = True
    with conn.cursor() as c:
        c.execute("SELECT 1;")
        c.fetchone()
    return conn


def _keys(prefix: str, sid: str):
    return (f"{prefix}:{sid}:segments", f"{prefix}:{sid}:summaries", f"{prefix}:{sid}:meta")


def _to_ts(ms_val):
    """epoch ms → datetime (없으면 None)"""
    try:
        ms = int(ms_val)
        return datetime.fromtimestamp(ms / 1000.0)
    except Exception:
        return None


def ingest_one_session(sid: str, prefix: str):
    """
    지정 세션(sid, prefix) 하나를 Postgres로 적재한다.
    
    Args:
        sid: 세션 ID (recording_sessions.id로 사용될 값)
        prefix: Redis 키 프리픽스 (예: stt:2025-10-30)
        
    Returns:
        int: recording_sessions.id
        
    Note:
        - sid를 recording_sessions.id로 직접 사용
        - 멱등성: 이미 적재된 경우 해당 session_id 반환
    """
    KEY_SEG, KEY_SUM, KEY_META = _keys(prefix, sid)
    r = _redis_client()
    
    # ✅ 이미 적재된 SID면 바로 해당 session_id 반환 (멱등)
    cached = r.get(f"{prefix}:{sid}:ingested_session_id")
    if cached:
        return int(cached)
    
    conn = _pg_connect()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # 0) meta
        meta = r.hgetall(KEY_META)
        if not meta or "started_at_ms" not in meta:
            raise RuntimeError(f"Meta missing: {KEY_META} (need started_at_ms)")

        base_ms  = int(meta["started_at_ms"])
        ended_ms = int(meta.get("ended_at_ms", base_ms))
        board_id = resolve_board_id(meta)
        user_id  = resolve_user_id(meta)

        # ✅ SID를 session_id로 직접 사용
        session_id = int(sid)

        # 0-1) recording_sessions
        cur.execute("""
            INSERT INTO recording_sessions
              (id, board_id, user_id, status, started_at, ended_at, created_at, is_diarized)
            VALUES
              (%s, %s, %s, 'saved',
               to_timestamp(%s/1000.0), to_timestamp(%s/1000.0), NOW(), FALSE)
            ON CONFLICT (id) DO NOTHING
            RETURNING id;
        """, (session_id, board_id, user_id, base_ms, ended_ms))
        
        result = cur.fetchone()
        if result is None:
            # 이미 존재하는 경우
            print(f"[INFO] {sid} already exists in recording_sessions")
        else:
            print(f"[OK] {sid} recording_sessions created with id={session_id}")

        # 1) segments → recording_results
        seg_entries = r.xrange(KEY_SEG, "-", "+")
        inserted_segments = 0
        for _id, f in seg_entries:
            raw_text      = f.get("raw_text")
            speaker_label = f.get("speaker_label") or None
            ts_start_ms   = f.get("ts_start_ms")
            ts_end_ms     = f.get("ts_end_ms")
            if not raw_text or ts_start_ms is None or ts_end_ms is None:
                continue

            started_at = _to_ts(base_ms + int(ts_start_ms))
            ended_at   = _to_ts(base_ms + int(ts_end_ms))
            if not started_at or not ended_at:
                continue

            cur.execute("""
                INSERT INTO recording_results
                  (recording_session_id, speaker_label, raw_text, started_at, ended_at)
                VALUES (%s, %s, %s, %s, %s);
            """, (session_id, speaker_label, raw_text, started_at, ended_at))
            inserted_segments += 1

        conn.commit()
        print(f"[OK] {sid} recording_results inserted={inserted_segments}")

        # 2) summaries
        sum_entries = r.xrange(KEY_SUM, "-", "+")
        inserted_summaries = 0
        for _id, f in sum_entries:
            summary_text = f.get("summary_text")
            if not summary_text:
                continue

            istart_ms = f.get("interval_start_ms")
            iend_ms   = f.get("interval_end_ms")
            model     = f.get("model")

            try:
                tokens_in  = int(f["tokens_input"])  if f.get("tokens_input")  else None
            except Exception:
                tokens_in  = None
            try:
                tokens_out = int(f["tokens_output"]) if f.get("tokens_output") else None
            except Exception:
                tokens_out = None

            interval_start_at = _to_ts(istart_ms) if istart_ms is not None else None
            interval_end_at   = _to_ts(iend_ms)   if iend_ms   is not None else None

            cur.execute("""
                INSERT INTO summaries
                  (recording_session_id, summary_type, content,
                   interval_start_at, interval_end_at, model, tokens_input, tokens_output, created_at)
                VALUES
                  (%s, %s, %s, %s, %s, %s, %s, %s, NOW());
            """, (
                session_id, 'interval', summary_text,
                interval_start_at, interval_end_at,
                model, tokens_in, tokens_out
            ))
            inserted_summaries += 1

        conn.commit()
        print(f"[OK] {sid} summaries inserted={inserted_summaries}")

        # 3) audio_data
        audio_path  = meta.get("audio_path")
        duration_ms = meta.get("duration_ms")
        language    = meta.get("language")

        if audio_path:
            try:
                cipher_path = encrypt_path(audio_path)
            except Exception as e:
                print(f"[WARN] Failed to encrypt path: {e}")
                cipher_path = audio_path

            try:
                duration_sec = int(int(duration_ms) / 1000) if duration_ms is not None else None
            except Exception:
                duration_sec = None

            cur.execute("""
                INSERT INTO audio_data (board_id, recording_session_id, file_path, duration, language, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT DO NOTHING;
            """, (board_id, session_id, cipher_path, duration_sec, language))

        conn.commit()
        print(f"[OK] {sid} audio_data inserted")

        # ✅ 재실행 방지: 세션ID를 SID에 매핑해 캐시(7일)
        try:
            r.setex(f"{prefix}:{sid}:ingested_session_id", 7 * 24 * 3600, str(session_id))
            ttl = 24 * 3600  # 24h 보존
            try:
                r.expire(KEY_SEG, ttl)
                r.expire(KEY_SUM, ttl)
                r.expire(KEY_META, ttl)
            except Exception:
                pass
        except Exception:
            pass

        # ✅ 이 세션의 PK 반환
        return session_id

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Failed to ingest {sid}: {e}")
        raise
    finally:
        cur.close()
        conn.close()


def ingest_all_for_prefix(prefix: str):
    """
    같은 날짜(prefix)의 모든 sid를 찾아 순회 적재 (B안 인덱스 세트 기준).
    """
    r = _redis_client()
    sids = sorted(r.smembers(f"{prefix}:sids"))
    for sid in sids:
        ingest_one_session(sid, prefix)


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
        ingest_all_for_prefix(prefix)
    else:
        if len(sys.argv) < 3:
            print("Missing prefix")
            sys.exit(1)
        sid = sys.argv[1]
        prefix = sys.argv[2]
        ingest_one_session(sid, prefix)