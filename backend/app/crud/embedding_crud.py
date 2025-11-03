"""
backend/app/crud/embedding_crud.py
벡터 저장 및 유사도 검색
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
import numpy as np

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
    
    Args:
        db: DB 세션
        session_id: 녹음 세션 ID
        user_id: 사용자 ID
        chunks: [(텍스트, 인덱스), ...]
        embeddings: 벡터 리스트
        metadata: 추가 메타데이터 (날짜, 제목 등)
        
    Returns:
        저장된 RecordingEmbedding 객체 리스트
    """
    saved_embeddings = []
    
    for (text, chunk_index), embedding in zip(chunks, embeddings):
        embedding_obj = m.RecordingEmbedding(
            recording_session_id=session_id,
            user_id=user_id,
            text_chunk=text,
            embedding=embedding.tolist(),  # numpy array → list
            chunk_index=chunk_index,
            chunk_metadata=metadata or {}
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
    유사도 검색 (코사인 유사도)
    
    Args:
        db: DB 세션
        user_id: 사용자 ID (자신의 녹음만 검색)
        query_embedding: 질문 벡터
        top_k: 상위 N개 결과
        similarity_threshold: 최소 유사도 (0.6 = 60%)
        
    Returns:
        [
            {
                "session_id": 84,
                "text": "프론트엔드 디자인은...",
                "similarity": 0.87,
                "metadata": {"date": "2025-10-29", ...},
                "date": "2025-10-29T10:00:00",
                "title": "회의록 제목"
            },
            ...
        ]
    """
    # pgvector 코사인 유사도 검색 (1 - cosine distance)
    query = text("""
        SELECT 
            re.recording_session_id,
            re.text_chunk,
            re.chunk_metadata,
            1 - (re.embedding <=> :query_vector) AS similarity,
            rs.started_at,
            fs.title
        FROM recording_embeddings re
        JOIN recording_sessions rs ON re.recording_session_id = rs.id
        LEFT JOIN final_summaries fs ON re.recording_session_id = fs.recording_session_id
        WHERE re.user_id = :user_id
        AND 1 - (re.embedding <=> :query_vector) > :threshold
        ORDER BY re.embedding <=> :query_vector
        LIMIT :top_k
    """)
    
    results = db.execute(
        query,
        {
            "query_vector": query_embedding.tolist(),
            "user_id": user_id,
            "threshold": similarity_threshold,
            "top_k": top_k
        }
    ).fetchall()
    
    return [
        {
            "session_id": row[0],
            "text": row[1],
            "metadata": row[2] or {},
            "similarity": float(row[3]),
            "date": row[4].isoformat() if row[4] else None,
            "title": row[5]
        }
        for row in results
    ]


def delete_embeddings_by_session(db: Session, session_id: int) -> int:
    """
    특정 세션의 모든 임베딩 삭제
    
    Args:
        db: DB 세션
        session_id: 녹음 세션 ID
        
    Returns:
        삭제된 행 수
    """
    deleted = db.query(m.RecordingEmbedding).filter(
        m.RecordingEmbedding.recording_session_id == session_id
    ).delete()
    return deleted


def get_embedding_stats(db: Session, user_id: int) -> Dict[str, Any]:
    """
    사용자의 임베딩 통계
    
    Args:
        db: DB 세션
        user_id: 사용자 ID
        
    Returns:
        {"total_chunks": 150, "total_sessions": 10}
    """
    query = text("""
        SELECT 
            COUNT(*) as total_chunks,
            COUNT(DISTINCT recording_session_id) as total_sessions
        FROM recording_embeddings
        WHERE user_id = :user_id
    """)
    
    result = db.execute(query, {"user_id": user_id}).fetchone()
    
    return {
        "total_chunks": result[0] if result else 0,
        "total_sessions": result[1] if result else 0
    }


def check_session_has_embeddings(db: Session, session_id: int) -> bool:
    """
    세션에 임베딩이 있는지 확인
    
    Args:
        db: DB 세션
        session_id: 녹음 세션 ID
        
    Returns:
        임베딩 존재 여부
    """
    count = db.query(m.RecordingEmbedding).filter(
        m.RecordingEmbedding.recording_session_id == session_id
    ).count()
    
    return count > 0