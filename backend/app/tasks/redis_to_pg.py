# backend/app/tasks/redis_to_pg.py

import sys
from datetime import datetime
import psycopg2
import redis
from backend.config import REDIS_URL, DATABASE_URL, resolve_board_id, resolve_user_id



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
    config.DATABASE_URL 사용.
    """
    conn = psycopg2.connect(DATABASE_URL)
    # ⚠️ 트랜잭션 열리지 않게 먼저 autocommit 켜고 핑
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


def ingest_one_session(prefix: str, sid: str):
    """
    지정 세션(prefix, sid) 하나를 Postgres로 적재한다.
    - recording_sessions row 생성 후 id 확보
    - segments → recording_results (절대 epoch으로 변환)
    (summaries는 B안 마이그레이션 완료 후 추가)
    """
    KEY_SEG, KEY_SUM, KEY_META = _keys(prefix, sid)
    r = _redis_client()
    conn = _pg_connect()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # 0) meta 읽기 (세션 절대 시계)
        meta = r.hgetall(KEY_META)  # { started_at_ms, ended_at_ms, ... }
        if not meta or "started_at_ms" not in meta:
            raise RuntimeError(f"Meta missing: {KEY_META} (need started_at_ms)")
        base_ms  = int(meta["started_at_ms"])                 # 세션 시작 epoch(ms) — NOT NULL
        ended_ms = int(meta.get("ended_at_ms", base_ms))      # 종료 ms (없으면 시작 시각으로 일단 맞춤)
        # board_id 결정 (meta > DEFAULT)
        board_id = resolve_board_id(meta)
        user_id  = resolve_user_id(meta)

        # 0-1) recording_sessions row 생성
        #  - status : ingest 시점 = 이미 종료된 세션 → 'saved'
        #  - started_at/ended_at : Redis meta의 epoch(ms) 사용
        #  - created_at : 지금 시각(NOW())로 채워서 NOT NULL 충족
        cur.execute("""
            INSERT INTO recording_sessions
              (board_id, user_id, status, started_at, ended_at, created_at)
            VALUES
              (%s, %s, 'saved',
               to_timestamp(%s/1000.0), to_timestamp(%s/1000.0), NOW())
            RETURNING id;
        """, (board_id, user_id, base_ms, ended_ms))
        session_id = cur.fetchone()[0]

        # 1) segments → recording_results
        seg_entries = r.xrange(KEY_SEG, "-", "+")
        inserted_segments = 0

        for _id, f in seg_entries:
            raw_text      = f.get("raw_text")
            speaker_label = f.get("speaker_label") or "A"
            ts_start_ms   = f.get("ts_start_ms")
            ts_end_ms     = f.get("ts_end_ms")
            if not raw_text or ts_start_ms is None or ts_end_ms is None:
                continue

            # 절대 epoch(ms): 세션 시작 epoch + 상대 ms
            started_epoch_ms = base_ms + int(ts_start_ms)
            ended_epoch_ms   = base_ms + int(ts_end_ms)
            started_at = _to_ts(started_epoch_ms)
            ended_at   = _to_ts(ended_epoch_ms)
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

    except Exception:
        conn.rollback()
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
        ingest_one_session(prefix, sid)


if __name__ == "__main__":
    # CLI 사용:
    # 1) 한 세션:  python backend/app/tasks/redis_to_pg.py stt:YYYY-MM-DD <sid>
    # 2) 하루 전체: python backend/app/tasks/redis_to_pg.py stt:YYYY-MM-DD --all
    if len(sys.argv) < 2:
        print("Usage: python backend/app/tasks/redis_to_pg.py <stt:YYYY-MM-DD> [<sid>|--all]")
        sys.exit(1)
    prefix = sys.argv[1]
    if len(sys.argv) == 3 and sys.argv[2] == "--all":
        ingest_all_for_prefix(prefix)
    elif len(sys.argv) >= 3:
        ingest_one_session(prefix, sys.argv[2])
    else:
        print("Missing <sid> or --all")
        sys.exit(1)
