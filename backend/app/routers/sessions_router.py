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
from backend.app import model as models
from backend.app import model as models  # ✅ FinalSummary ORM 접근용
from pydantic import BaseModel
from typing import List
from backend.app.tasks.final_summary import (
    build_final_summary_from_lines,
    persist_final_summary,
)
from backend.app.schemas.sessions_schema import (RecordingSessionListResponse, RecordingSessionResponse)
from backend.app.crud.session_crud import get_sessions_by_board

router = APIRouter(prefix="/sessions", tags=["sessions"])

class FinalizePayload(BaseModel):
    lines: List[str]

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

@router.post("/{session_id}/finalize-summary")
async def finalize_summary(session_id: int, payload: FinalizePayload):
    """
    프론트에서 확정 문장 배열(lines)을 보내면
    → Qwen으로 최종 요약 생성 → final_summaries에 저장 → 결과 반환
    (Redis/메모리/레코드 의존 없이 안정적으로 동작)
    """
    # 1) 최소 검증
    lines = [ln.strip() for ln in payload.lines if ln and ln.strip()]
    if not lines:
        raise HTTPException(status_code=400, detail="No lines to summarize")

    # 2) 실제 세션 존재 확인(안전)
    with SessionLocal() as db:
        exists = db.query(models.RecordingSession.id).filter(models.RecordingSession.id == session_id).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Session not found")

    # 3) 요약 생성
    final_json = await build_final_summary_from_lines(lines)
    raw_text = "\n".join(lines)

    # 4) DB 저장
    persist_final_summary(
        recording_session_id=session_id,
        summary_json=final_json,
        raw_text=raw_text,
    )

    # 5) 응답(프론트 즉시 표시용)
    return final_json


@router.get("/final-summaries/by-session/{session_id}")
def get_final_summary_by_session(session_id: int):
    """
    프론트에서 세션 전체 요약을 읽을 때 사용하는 엔드포인트.
    final_summaries 테이블의 최신 1건을 반환한다.
    """
    with SessionLocal() as db:
        row = (
            db.query(models.FinalSummary)
            .filter(models.FinalSummary.recording_session_id == session_id)
            .order_by(models.FinalSummary.created_at.desc())
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Final summary not found")
        return {
            "title": row.title,
            "bullets": row.bullets or [],
            "actions": row.actions or [],
            "content": row.content,
            "created_at": row.created_at,
        }