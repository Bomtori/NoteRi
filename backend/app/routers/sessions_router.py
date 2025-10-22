# backend/app/routers/sessions_router.py
from fastapi import APIRouter, HTTPException, BackgroundTasks
from backend.app.util.redis_client import get_redis
from sqlalchemy import desc
from backend.app.db import SessionLocal
from backend.app.model import RecordingSession, RecordingResult
from backend.services.diarization import run_diarization_for_session

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.get("/latest")
def get_latest_session():
    with SessionLocal() as db:
        sess = (
            db.query(RecordingSession)
              .order_by(desc(RecordingSession.created_at))
              .first()
        )
        if not sess:
            raise HTTPException(status_code=404, detail="no session")
        return {"id": sess.id, "is_diarized": bool(sess.is_diarized)}

@router.get("/{session_id}")
def get_session(session_id: int):
    with SessionLocal() as db:
        sess = db.query(RecordingSession).get(session_id)
        if not sess:
            raise HTTPException(status_code=404, detail="session not found")
        return {
            "id": sess.id,
            "is_diarized": bool(sess.is_diarized),
            "started_at": sess.started_at,
            "ended_at": sess.ended_at,
            "status": str(sess.status) if hasattr(sess.status, "value") else sess.status,
        }

@router.get("/{session_id}/results")
def get_session_results(session_id: int):
    with SessionLocal() as db:
        sess = db.query(RecordingSession).get(session_id)
        if not sess:
            raise HTTPException(404, "session not found")

        rows = (
            db.query(RecordingResult)
              .filter(RecordingResult.recording_session_id == session_id)
              .order_by(RecordingResult.started_at.asc())
              .all()
        )
        start0 = sess.started_at.timestamp() if sess.started_at else None

        out = []
        for r in rows:
            st = r.started_at.timestamp() if r.started_at else None
            en = r.ended_at.timestamp()   if r.ended_at   else None
            out.append({
                "id": r.id,
                "raw_text": r.raw_text,
                "speaker_label": r.speaker_label,
                "started_at": r.started_at,  # 원본 timestamp (그대로 둬도 됨)
                "ended_at": r.ended_at,
                "offset_start_sec": (st - start0) if (st and start0) else None,
                "offset_end_sec": (en - start0) if (en and start0) else None,
            })
        return out
    
@router.post("/{session_id}/diarize", status_code=202)
def start_diarization(session_id: int, bg: BackgroundTasks):
    with SessionLocal() as db:
        sess = db.query(RecordingSession).get(session_id)
        if not sess:
            raise HTTPException(status_code=404, detail="session not found")
        if bool(sess.is_diarized):
            return {"ok": True, "session_id": session_id, "queued": False, "msg": "already diarized"}

    bg.add_task(run_diarization_for_session, session_id)
    return {"ok": True, "session_id": session_id, "queued": True}

@router.get("/by-sid/{sid}")
async def get_session_id_by_sid(sid: str):
    r = await get_redis()
    key = f"stt:last_session_id:{sid}"
    val = await r.get(key)
    if not val:
        # 아직 ingest가 안 끝났을 수 있으니 404를 주되, 프론트는 폴링하도록 설계
        raise HTTPException(status_code=404, detail="session id not found for sid")
    return {"id": int(val)}
