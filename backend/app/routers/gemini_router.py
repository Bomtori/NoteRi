# backend/app/routers/ai_router.py
from __future__ import annotations

import time
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Query, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, and_, func
from pydantic import BaseModel, Field

from backend.app.model import AIGemini
from backend.app.util.gemini_client import generate_text
from backend.app.deps.auth import get_current_user
from backend.app.db import get_db
from backend.app.crud import gemini_crud
from backend.app.schemas.gemini_shcema import (
ChatItem, ChatListResponse, _truncate
)

router = APIRouter(prefix="/gemini", tags=["gemini"])

class ChatIn(BaseModel):
    prompt: str = Field(..., min_length=1)
    temperature: float = 0.3
    max_output_tokens: int = 256

@router.post("/chat", summary="채팅 입력")
def chat(inb: ChatIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # 1) 호출
    t0 = time.monotonic()
    text, meta = generate_text(
        inb.prompt, temperature=inb.temperature, max_output_tokens=inb.max_output_tokens
    )
    latency_ms = int((time.monotonic() - t0) * 1000)

    # 2) 응답 먼저
    resp = {"text": text, "meta": meta, "empty": (text.strip() == "")}

    # 3) 저장은 백그라운드로(마스킹/자르기 포함)
    def _mask(s: str | None, limit=4000):
        if not s:
            return s
        s = s.strip()
        # 간단 마스킹 예시(이메일/전화)
        import re
        s = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[email]", s, flags=re.I)
        s = re.sub(r"\b(01[016789]-?\d{3,4}-?\d{4})\b", "[phone]", s)
        # 길이 제한
        return (s[:limit] + "…") if len(s) > limit else s

    background_tasks.add_task(
        gemini_crud.save_ai_interaction,
        db=db,
        user_id=(user.id if user else None),
        model=meta.get("model"),
        api_path=meta.get("api", "unknown"),
        status=("ok" if text else "error"),
        latency_ms=latency_ms,
        prompt_text=_mask(inb.prompt),
        response_text=_mask(text),
        input_tokens=meta.get("input_tokens"),
        output_tokens=meta.get("output_tokens"),
        finish_reason=meta.get("finish_reason"),
        safety=meta.get("safety"),
        meta=meta,
        is_sampled=True,
    )

    return resp

# 채팅 불러오기

@router.get("", response_model=ChatListResponse, summary="채팅 목록 가져오기")
def list_history(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),  # 없으면 user_id: int = Query(...)
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = Query(
        None,
        description="이 시간(미포함)보다 이전 레코드를 가져옵니다. ISO8601 (예: 2025-10-14T02:59:00Z)",
    ),
    include_errors: bool = Query(
        False, description="에러로 기록된 항목도 포함할지 여부"
    ),
    with_total: bool = Query(
        False, description="전체 개수를 계산해서 반환(쿼리 비용 증가)"
    ),
    max_text: int = Query(
        4000, ge=64, le=20000, description="prompt/response 최대 노출 길이"
    ),
):
    # 기본 쿼리
    conds = [AIGemini.user_id == user.id]
    if not include_errors:
        conds.append(AIGemini.status == "ok")
    if cursor:
        try:
            ts = datetime.fromisoformat(cursor.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="cursor는 ISO8601 형식이어야 합니다.")
        # created_at < cursor
        conds.append(AIGemini.created_at < ts)

    stmt = (
        select(AIGemini)
        .where(and_(*conds))
        .order_by(desc(AIGemini.created_at), desc(AIGemini.id))
        .limit(limit + 1) 
    )

    rows = db.execute(stmt).scalars().all()

    has_more = len(rows) > limit
    rows = rows[:limit]

    items: List[ChatItem] = []
    for r in rows:
        items.append(
            ChatItem(
                id=r.id,
                created_at=r.created_at,
                model=r.model,
                api_path=r.api_path,
                status=r.status,
                prompt_text=_truncate(r.prompt_text, max_text),
                response_text=_truncate(r.response_text, max_text),
                empty=not bool((r.response_text or "").strip()),
            )
        )

    next_cursor_val: Optional[str] = None
    if has_more and rows:
        next_cursor_val = rows[-1].created_at.isoformat()

    total_count: Optional[int] = None
    if with_total:
        cnt_stmt = select(func.count()).where(and_(*conds[:-1])) if cursor else select(func.count()).where(and_(*conds))
        total_count = db.execute(cnt_stmt).scalar_one()

    return ChatListResponse(items=items, next_cursor=next_cursor_val, total_count=total_count)


# 특정 채팅 정보 가져오기
@router.get("/{item_id}", response_model=ChatItem, summary="특정 채팅 정보")
def get_history_item(
    item_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    r = db.get(AIGemini, item_id)
    if not r or r.user_id != user.id:
        raise HTTPException(status_code=404, detail="not found")
    return ChatItem(
        id=r.id,
        created_at=r.created_at,
        model=r.model,
        api_path=r.api_path,
        status=r.status,
        prompt_text=r.prompt_text,
        response_text=r.response_text,
        empty=not bool((r.response_text or "").strip()),
    )
