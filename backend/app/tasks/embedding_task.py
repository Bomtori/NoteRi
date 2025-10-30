"""
backend/app/tasks/embedding_task.py
비동기 임베딩 생성 태스크
"""

import asyncio
from sqlalchemy.orm import Session
from backend.app.db import SessionLocal
from backend.app import model as m
from backend.app.crud import embedding_crud
from backend.ml.embeddings.embedding_model import get_embedder
import logging

logger = logging.getLogger(__name__)


async def create_embeddings_for_session(session_id: int):
    """
    녹음 완료 후 자동으로 임베딩 생성
    
    Args:
        session_id: RecordingSession ID
    """
    try:
        logger.info(f"🔄 Starting auto-embedding for session {session_id}")
        
        # asyncio.to_thread로 블로킹 작업을 별도 스레드에서 실행
        await asyncio.to_thread(_create_embeddings_sync, session_id)
        
        logger.info(f"✅ Auto-embedding completed for session {session_id}")
        
    except Exception as e:
        logger.error(f"❌ Auto-embedding failed for session {session_id}: {e}")


def _create_embeddings_sync(session_id: int):
    """
    동기 임베딩 생성 로직 (별도 스레드에서 실행)
    """
    with SessionLocal() as db:
        # 1. 세션 정보 먼저 가져오기 (user_id 포함)
        session = db.query(m.RecordingSession).filter(
            m.RecordingSession.id == session_id
        ).first()
        
        if not session:
            logger.error(f"❌ Session {session_id} not found")
            return
        
        user_id = session.user_id
        
        if not user_id:
            logger.error(f"❌ No user_id for session {session_id}")
            return
        
        # 2. 회의록 텍스트 수집
        results = db.query(m.RecordingResult).filter(
            m.RecordingResult.recording_session_id == session_id
        ).all()
        
        if not results:
            logger.warning(f"⚠️ No results found for session {session_id}")
            return
        
        full_text = " ".join([r.raw_text for r in results if r.raw_text])
        
        if not full_text.strip():
            logger.warning(f"⚠️ Empty text for session {session_id}")
            return
        
        # 3. 임베딩 생성
        embedder = get_embedder()
        chunks = embedder.chunk_text(full_text, chunk_size=500, overlap=50)
        
        if not chunks:
            logger.warning(f"⚠️ No chunks generated for session {session_id}")
            return
        
        logger.info(f"📝 Generated {len(chunks)} chunks for session {session_id}")
        
        # 4. 배치 임베딩
        embeddings = embedder.embed_batch([chunk[0] for chunk in chunks])
        
        # 5. 기존 임베딩 삭제 (재생성 시)
        existing_count = embedding_crud.delete_embeddings_by_session(db, session_id)
        if existing_count > 0:
            logger.info(f"🗑️ Deleted {existing_count} existing embeddings")
        
        # 6. DB 저장
        embedding_crud.save_embeddings(
            db=db,
            session_id=session_id,
            user_id=user_id,
            chunks=chunks,
            embeddings=embeddings,
            metadata={
                "date": session.started_at.isoformat() if session.started_at else None,
                "board_id": session.board_id
            }
        )
        
        logger.info(f"💾 Saved {len(chunks)} embeddings for session {session_id}")


def create_embeddings_sync_wrapper(session_id: int, user_id: int):
    """
    동기 환경에서 호출 가능한 래퍼 함수
    (예: FastAPI BackgroundTasks)
    """
    try:
        _create_embeddings_sync(session_id)
    except Exception as e:
        logger.error(f"❌ Embedding creation failed: {e}")