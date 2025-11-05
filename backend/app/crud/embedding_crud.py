"""
backend/app/crud/embedding_crud.py
벡터 저장 및 유사도 검색 (pgvector 바인딩 버전)
"""

from sqlalchemy.orm import Session
from sqlalchemy import text, bindparam
from typing import List, Dict, Any, Optional
import numpy as np
from pgvector.sqlalchemy import Vector   # ✅ 추가

from backend.app import model as m


def save_embeddings(
    db: Session,
    session_id: int,
    user_id: int,
    chunks: List[tuple],  # [(text, index), ...]
    embeddings: List[np.ndarray],
    metadata: Optional[Dict[str, Any]] = None
) -> List[m.RecordingEmbedding]:
    """
    텍스트 청크와 벡터를 DB에 저장
    """
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
    similarity_threshold: float = 0.6
) -> List[Dict[str, Any]]:
    """
    유사도 검색 (pgvector 코사인 유사도)
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
        LEFT JOIN final_summaries fs ON re.recording_session_id = fs.recording_session_id
        WHERE re.user_id = :user_id
          AND (1 - (re.embedding <=> :qv)) > :threshold
        ORDER BY re.embedding <=> :qv
        LIMIT :top_k
    """).bindparams(
        bindparam("qv", type_=Vector(768)),   # ✅ 핵심: Vector 타입 바인딩
        bindparam("user_id"),
        bindparam("threshold"),
        bindparam("top_k"),
    )

    rows = db.execute(
        sql,
        {
            "qv": query_embedding.tolist(),
            "user_id": int(user_id),
            "threshold": float(similarity_threshold),
            "top_k": int(top_k),
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
    """
    특정 세션의 모든 임베딩 삭제
    """
    deleted = db.query(m.RecordingEmbedding).filter(
        m.RecordingEmbedding.recording_session_id == session_id
    ).delete(synchronize_session=False)
    return deleted


def get_embedding_stats(db: Session, user_id: int) -> Dict[str, Any]:
    """
    사용자의 임베딩 통계
    """
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
    """
    세션에 임베딩이 있는지 확인
    """
    count = db.query(m.RecordingEmbedding).filter(
        m.RecordingEmbedding.recording_session_id == session_id
    ).count()
    return count > 0
