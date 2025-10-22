# backend/app/tasks/redis_to_pg.py

import sys
from datetime import datetime
import psycopg2
import redis
from backend.config import REDIS_URL, DATABASE_URL, resolve_board_id, resolve_user_id
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
    - segments → recording_results
    - summaries → summaries
    - audio_data → audio_data
    """
    KEY_SEG, KEY_SUM, KEY_META = _keys(prefix, sid)
    r = _redis_client()
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

        # 0-1) recording_sessions
        cur.execute("""
            INSERT INTO recording_sessions
              (board_id, user_id, status, started_at, ended_at, created_at, is_diarized)
            VALUES
              (%s, %s, 'saved',
               to_timestamp(%s/1000.0), to_timestamp(%s/1000.0), NOW(), FALSE)
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

            interval_start_at = _to_ts(base_ms + int(istart_ms)) if istart_ms is not None else None
            interval_end_at   = _to_ts(base_ms + int(iend_ms))   if iend_ms   is not None else None

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
        print(f"[OK] {sid} recording_results inserted={inserted_segments}, summaries inserted={inserted_summaries}")

        # 3) audio_data
        audio_path  = meta.get("audio_path")
        duration_ms = meta.get("duration_ms")
        language    = meta.get("language")
        cipher_path = encrypt_path(audio_path)

        if audio_path:
            try:
                duration_sec = int(int(duration_ms) / 1000) if duration_ms is not None else None
            except Exception:
                duration_sec = None

            cur.execute("""
                INSERT INTO audio_data (board_id, recording_session_id, file_path, duration, language, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW());
            """, (board_id, session_id, cipher_path, duration_sec, language))

        conn.commit()
        print(f"[OK] {sid} recording_results inserted={inserted_segments}, "
              f"summaries inserted={inserted_summaries}, "
              f"audio_data inserted (encrypted)")

        # ✅ 여기서 세션 PK를 반환한다
        return session_id

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
