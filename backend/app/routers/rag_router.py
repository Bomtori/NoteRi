"""
backend/app/routers/rag_router.py
RAG 질의응답 API
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from backend.app.db import get_db
from backend.app.deps.auth import get_current_user
from backend.app import model as m
from backend.app.crud import embedding_crud
from backend.ml.embeddings.embedding_model import get_embedder
from backend.app.util.llm_client import ollama_summarize_interval
import httpx
import os

router = APIRouter(prefix="/rag", tags=["RAG"])


# === Schemas ===

class AskRequest(BaseModel):
    question: str
    top_k: int = 5  # 검색할 최대 결과 수
    

class SourceResponse(BaseModel):
    session_id: int
    text: str
    similarity: float
    date: Optional[str]
    title: Optional[str]


class AskResponse(BaseModel):
    question: str
    answer: str
    sources: List[SourceResponse]


class EmbedSessionRequest(BaseModel):
    session_id: int


# === API Endpoints ===

@router.post("/ask", response_model=AskResponse)
async def ask_question(
    request: AskRequest,
    current_user: m.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    사용자 질문에 대해 회의록을 검색하고 답변 생성
    
    **예시:**
    ```
    POST /rag/ask
    {
        "question": "프론트 디자인 언제 한다했지?",
        "top_k": 5
    }
    ```
    
    **응답:**
    ```json
    {
        "question": "프론트 디자인 언제 한다했지?",
        "answer": "2025-10-29일 오전 10시 회의에서...",
        "sources": [...]
    }
    ```
    """
    # 1. 질문 임베딩 생성
    embedder = get_embedder()
    query_embedding = embedder.embed_text(request.question)
    
    # 2. 유사한 회의록 검색
    search_results = embedding_crud.search_similar_chunks(
        db=db,
        user_id=current_user.id,
        query_embedding=query_embedding,
        top_k=request.top_k,
        similarity_threshold=0.5  # 50% 이상 유사도
    )
    
    if not search_results:
        raise HTTPException(
            status_code=404,
            detail="관련된 회의록을 찾을 수 없습니다. 녹음 기록이 있는지 확인해주세요."
        )
    
    # 3. 컨텍스트 구성
    context = "\n\n".join([
        f"[{result['date']} - {result['title'] or '제목 없음'}]\n{result['text']}"
        for result in search_results
    ])
    
    # 4. LLM 프롬프트 생성
    prompt = f"""당신은 회의록 검색 어시스턴트입니다. 아래의 회의록 내용을 참고하여 사용자의 질문에 답변하세요.

**회의록 내용:**
{context}

**사용자 질문:**
{request.question}

**답변 규칙:**
1. 회의록 내용만 참고하여 답변
2. 날짜와 시간을 명확히 언급
3. 찾을 수 없으면 "회의록에서 관련 내용을 찾을 수 없습니다" 답변
4. 간결하고 명확하게 답변

**답변:**"""
    
    # 5. Ollama로 답변 생성
    try:
        
        OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct-q4_K_M")
        
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_ctx": 4096,
                "temperature": 0.3,
            }
        }
        
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
            r.raise_for_status()
            answer = r.json().get("response", "").strip()
            
    except Exception as e:
        # Ollama 실패 시 검색 결과만 반환
        answer = f"관련 내용을 찾았습니다:\n\n{search_results[0]['text'][:200]}..."

    # 6. 응답 구성
    sources = [
        SourceResponse(
            session_id=result["session_id"],
            text=result["text"][:200] + "..." if len(result["text"]) > 200 else result["text"],
            similarity=result["similarity"],
            date=result["date"],
            title=result["title"]
        )
        for result in search_results
    ]
    
    return AskResponse(
        question=request.question,
        answer=answer,
        sources=sources
    )


@router.get("/stats")
async def get_rag_stats(
    current_user: m.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    사용자의 RAG 통계 조회
    
    **응답:**
    ```json
    {
        "total_chunks": 150,
        "total_sessions": 10
    }
    ```
    """
    stats = embedding_crud.get_embedding_stats(db, current_user.id)
    return stats


@router.post("/embed/{session_id}")
async def create_embeddings(
    session_id: int,
    current_user: m.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    특정 세션의 임베딩 생성
    
    **사용 시점:**
    - 새 녹음 완료 시
    - 기존 녹음 재처리 시
    """
    # 세션 권한 확인
    session = db.query(m.RecordingSession).filter(
        m.RecordingSession.id == session_id,
        m.RecordingSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    
    # 회의록 텍스트 수집
    results = db.query(m.RecordingResult).filter(
        m.RecordingResult.recording_session_id == session_id
    ).all()
    
    if not results:
        raise HTTPException(status_code=400, detail="녹음 텍스트가 없습니다")
    
    full_text = " ".join([r.raw_text for r in results if r.raw_text])
    
    if not full_text.strip():
        raise HTTPException(status_code=400, detail="유효한 텍스트가 없습니다")
    
    # 임베딩 생성
    embedder = get_embedder()
    chunks = embedder.chunk_text(full_text)
    
    if not chunks:
        raise HTTPException(status_code=400, detail="텍스트 분할 실패")
    
    embeddings = embedder.embed_batch([chunk[0] for chunk in chunks])
    
    # 기존 임베딩 삭제 (재생성 시)
    embedding_crud.delete_embeddings_by_session(db, session_id)
    
    # 저장
    embedding_crud.save_embeddings(
        db=db,
        session_id=session_id,
        user_id=current_user.id,
        chunks=chunks,
        embeddings=embeddings,
        metadata={"date": session.started_at.isoformat() if session.started_at else None}
    )
    
    return {
        "message": "임베딩 생성 완료",
        "session_id": session_id,
        "chunks": len(chunks)
    }


@router.delete("/embed/{session_id}")
async def delete_embeddings(
    session_id: int,
    current_user: m.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    특정 세션의 임베딩 삭제
    """
    # 세션 권한 확인
    session = db.query(m.RecordingSession).filter(
        m.RecordingSession.id == session_id,
        m.RecordingSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    
    deleted = embedding_crud.delete_embeddings_by_session(db, session_id)
    
    return {
        "message": "임베딩 삭제 완료",
        "deleted_chunks": deleted
    }


@router.post("/embed-all")
async def embed_all_sessions(
    current_user: m.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    사용자의 모든 세션 임베딩 생성 (최초 설정용)
    
    ⚠️ 시간이 오래 걸릴 수 있습니다!
    """
    # 사용자의 모든 세션 가져오기
    sessions = db.query(m.RecordingSession).filter(
        m.RecordingSession.user_id == current_user.id
    ).all()
    
    embedder = get_embedder()
    success_count = 0
    fail_count = 0
    
    for session in sessions:
        try:
            # 이미 임베딩이 있으면 건너뛰기
            if embedding_crud.check_session_has_embeddings(db, session.id):
                continue
            
            # 회의록 텍스트 수집
            results = db.query(m.RecordingResult).filter(
                m.RecordingResult.recording_session_id == session.id
            ).all()
            
            full_text = " ".join([r.raw_text for r in results if r.raw_text])
            
            if not full_text.strip():
                fail_count += 1
                continue
            
            # 임베딩 생성
            chunks = embedder.chunk_text(full_text)
            if not chunks:
                fail_count += 1
                continue
                
            embeddings = embedder.embed_batch([chunk[0] for chunk in chunks])
            
            # 저장
            embedding_crud.save_embeddings(
                db=db,
                session_id=session.id,
                user_id=current_user.id,
                chunks=chunks,
                embeddings=embeddings,
                metadata={"date": session.started_at.isoformat() if session.started_at else None}
            )
            
            success_count += 1
            
        except Exception as e:
            print(f"Error embedding session {session.id}: {e}")
            fail_count += 1
    
    return {
        "message": "일괄 임베딩 완료",
        "total_sessions": len(sessions),
        "success": success_count,
        "failed": fail_count
    }