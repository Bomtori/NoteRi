# backend/app/crud/embedding_crud.py

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy import text, bindparam
from typing import List, Dict, Any, Optional
import numpy as np
from pgvector.sqlalchemy import Vector

from backend.app import model as m


def save_embeddings(
    db: Session,
    session_id: int,
    user_id: int,
    chunks: List[tuple],
    embeddings: List[np.ndarray],
    metadata: Optional[Dict[str, Any]] = None
) -> List[m.RecordingEmbedding]:
    saved_embeddings: List[m.RecordingEmbedding] = []

    meta = metadata or {}
    for (text_chunk, chunk_index), embedding in zip(chunks, embeddings):
        embedding_obj = m.RecordingEmbedding(
            recording_session_id=session_id,
            user_id=user_id,
            text_chunk=text_chunk,
            embedding=embedding.tolist(),
            chunk_index=int(chunk_index),
            chunk_metadata=meta
        )
        db.add(embedding_obj)
        saved_embeddings.append(embedding_obj)

    return saved_embeddings


def search_similar_chunks(
    db: Session,
    user_id: int,
    query_embedding: np.ndarray,
    top_k: int = 5,
    similarity_threshold: float = 0.5,
    board_id: Optional[int] = None,
    session_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    유사도 검색 (pgvector 코사인 유사도)
    - 보드 소유자이거나 공유받은 보드 데이터까지 검색
    - 선택적으로 board_id, session_id로 스코프 제한 가능
    """
    sql = text("""
        SELECT
            re.recording_session_id,
            re.text_chunk,
            re.chunk_metadata,
            1 - (re.embedding <=> :qv) AS similarity,
            rs.started_at,
            fs.title
        FROM recording_embeddings re
        JOIN recording_sessions rs ON re.recording_session_id = rs.id
        JOIN boards b              ON rs.board_id = b.id
        LEFT JOIN board_shares bs  ON b.id = bs.board_id
        LEFT JOIN final_summaries fs ON re.recording_session_id = fs.recording_session_id
        WHERE (b.owner_id = :user_id OR bs.user_id = :user_id)
          AND (1 - (re.embedding <=> :qv)) >= :threshold
          AND (:board_id   IS NULL OR b.id = :board_id)
          AND (:session_id IS NULL OR rs.id = :session_id)
        ORDER BY re.embedding <=> :qv ASC
        LIMIT :top_k
    """).bindparams(
        bindparam("qv", type_=Vector(768)),
        bindparam("user_id"),
        bindparam("threshold"),
        bindparam("top_k"),
        bindparam("board_id"),
        bindparam("session_id"),
    )

    rows = db.execute(
        sql,
        {
            "qv": query_embedding.tolist(),
            "user_id": int(user_id),
            "threshold": float(similarity_threshold),
            "top_k": int(top_k),
            "board_id": int(board_id) if board_id is not None else None,
            "session_id": int(session_id) if session_id is not None else None,
        }
    ).fetchall()

    return [
        {
            "session_id": row[0],
            "text": row[1],
            "metadata": row[2] or {},
            "similarity": float(row[3]),
            "date": row[4].isoformat() if row[4] else None,
            "title": row[5],
        }
        for row in rows
    ]


def delete_embeddings_by_session(db: Session, session_id: int) -> int:
    deleted = db.query(m.RecordingEmbedding).filter(
        m.RecordingEmbedding.recording_session_id == session_id
    ).delete(synchronize_session=False)
    return deleted


def get_embedding_stats(db: Session, user_id: int) -> Dict[str, Any]:
    sql = text("""
        SELECT
            COUNT(*) AS total_chunks,
            COUNT(DISTINCT recording_session_id) AS total_sessions
        FROM recording_embeddings
        WHERE user_id = :user_id
    """)
    result = db.execute(sql, {"user_id": int(user_id)}).fetchone()
    return {
        "total_chunks": int(result[0]) if result else 0,
        "total_sessions": int(result[1]) if result else 0,
    }


def check_session_has_embeddings(db: Session, session_id: int) -> bool:
    count = db.query(m.RecordingEmbedding).filter(
        m.RecordingEmbedding.recording_session_id == session_id
    ).count()
    return count > 0


def get_text_chunks_by_session(db: Session, *, session_id: int) -> List[str]:
    # 컬럼명 수정: recording_session_id
    rows = db.execute(
        select(m.RecordingEmbedding.text_chunk)
        .where(m.RecordingEmbedding.recording_session_id == session_id)
        .order_by(m.RecordingEmbedding.id.asc())
    ).all()
    return [r[0] for r in rows if r and r[0]]
