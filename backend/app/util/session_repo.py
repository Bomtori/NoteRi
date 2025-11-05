# backend/app/util/session_repo.py (신규 파일 추천)
from datetime import datetime
from backend.app.db import SessionLocal
from backend.app import model

def ensure_session_saved(sid: int, board_id: int, user_id: int, started_at: datetime) -> None:
    """
    recording_sessions를 '선 생성'한다. 없으면 INSERT, 있으면 최소 상태를 'saved'로 끌어올린다.
    """
    with SessionLocal() as db:
        rs = db.get(model.RecordingSession, sid)
        if rs is None:
            rs = model.RecordingSession(
                id=sid,
                board_id=board_id,
                user_id=user_id,
                status='saved',                # 선 생성 상태
                started_at=started_at,         # 이미 가지고 있는 시작 시각
                ended_at=None,
                created_at=datetime.utcnow(),
                is_diarized=False,
            )
            db.add(rs)
        else:
            # 이미 있으면 최소 상태 보정
            if rs.status != 'saved':
                rs.status = 'saved'
            if rs.started_at is None:
                rs.started_at = started_at
        db.commit()

def finalize_session_completed(sid: int) -> None:
    """
    세션 최종화: ended_at 채우고 status='saved'로 전환.
    """
    with SessionLocal() as db:
        rs = db.get(model.RecordingSession, sid)
        if rs is None:
            # 방어적 선 생성 (가능하면 ensure_session_saved가 이미 해둠)
            rs = model.RecordingSession(
                id=sid,
                board_id=0,
                user_id=0,
                status='saved',
                started_at=datetime.utcnow(),
                ended_at=datetime.utcnow(),
                is_diarized=False,
            )
            db.add(rs)
        else:
            rs.status = 'saved'
            if rs.ended_at is None:
                rs.ended_at = datetime.utcnow()
        db.commit()
