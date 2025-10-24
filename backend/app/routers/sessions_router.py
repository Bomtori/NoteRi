# backend/app/routers/sessions_router.py
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status, BackgroundTasks
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.util.redis_client import get_redis
from sqlalchemy import desc
from backend.app.db import SessionLocal
from backend.app.model import RecordingSession, RecordingResult
from backend.services.diarization import run_diarization_for_session
from backend.app.schemas.sessions_schema import (RecordingSessionListResponse, RecordingSessionResponse)
from backend.app.crud.session_crud import get_sessions_by_board

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
    return {"ok": True, "session_id": session_id, "queued": True, "msg": "diarization started"}

@router.get("/by-sid/{sid}")
async def get_session_id_by_sid(sid: str):
    r = await get_redis()
    key = f"stt:last_session_id:{sid}"
    val = await r.get(key)
    if not val:
        # ⏳ 아직 매핑 전: 202(Processing)로 상태를 돌려주면 프론트가 부드럽게 계속 기다릴 수 있음
        return {"status": "pending"}, 202
    return {"id": int(val), "status": "ready"}

@router.get("/{board_id}/list", response_model=RecordingSessionListResponse, summary="보드에 속한 RecordingSession 목록 조회",
)
def list_recording_sessions_by_board(
    board_id: int = Path(..., ge=1),
    limit: int | None = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user),  # 권한 체크가 필요하면 활성화
):
    """
    주어진 board_id에 속한 모든 RecordingSession을 반환합니다.
    시작시간 최신순으로 정렬되며, 각 세션에는 audio(1:1), results_count, summaries_count가 포함됩니다.
    """
    total, items = get_sessions_by_board(db, board_id, limit=limit, offset=offset)
    return {"total": total, "items": items}