# ─────────────────────────────────────────────────────────────────────────────
# backend/app/services/notion_template.py
# ─────────────────────────────────────────────────────────────────────────────
from __future__ import annotations
from typing import Literal, List, Dict, Any
from sqlalchemy.orm import Session


from backend.app.crud.embedding_crud import get_text_chunks_by_session # (session_id) -> List[str]
from backend.app.crud.summary_crud import get_summaries_by_session # (session_id) -> List[model.Summary]
from backend.app.crud.final_summary_crud import get_final_summary_by_session # (session_id) -> model.FinalSummary | None
from backend.app.util.llm_client import ollama_summarize_json
from backend.app.crud.final_summary_crud import get_final_summary_by_session



TemplateType = Literal["script", "minutes", "final"]




def _merge_text_chunks(chunks: List[str], max_chars: int = 12000) -> str:
    """recording_embeddings.text_chunk 들을 순서대로 병합 (길이 상한 적용).
    너무 길면 모델 컨텍스트 낭비가 심하므로 상한을 둔다.
    """
    acc = []
    size = 0
    for c in chunks:
        if not c:
            continue
        if size + len(c) > max_chars:
            remain = max_chars - size
            if remain > 0:
                acc.append(c[:remain])
            break
        acc.append(c)
        size += len(c)
    return "\n".join(acc)


def _render_minutes_markdown(summaries: List[Dict[str, Any]]) -> str:
    """summaries.content 기반 회의기록(markdown)."""
    lines = ["## 회의기록"]
    for i, s in enumerate(summaries, 1):
        para = (s.get("content") or s.get("paragraph") or "").strip()
        brief = (s.get("summary") or "").strip()
        if not para and not brief:
            continue
        lines.append(f"\n### {i}. 기록")
        if para:
            lines.append(para)
        if brief:
            lines.append("\n**요약**\n- " + "\n- ".join([t.strip() for t in brief.split("\n") if t.strip()]))
    return "\n".join(lines).strip()




def _render_script_markdown(refined: List[Dict[str, Any]]) -> str:
    """정제 스크립트 (speaker_label + text) -> markdown."""
    lines = ["## 스크립트"]
    for row in refined:
        spk = row.get("speaker_label") or row.get("speaker") or "SPEAKER"
        txt = (row.get("text") or row.get("content") or "").strip()
        if txt:
            lines.append(f"- **[{spk}]** {txt}")
    return "\n".join(lines).strip()




def _render_final_markdown(title: str, bullets: List[str], actions: List[str]) -> str:
    lines = [f"# {title.strip() if title else '회의 요약'}", "\n## 핵심 정리"]
    if bullets:
        for b in bullets:
            if b and b.strip():
                lines.append(f"- {b.strip()}")
    lines.append("\n## 후속 조치")
    if actions:
        for a in actions:
            if a and a.strip():
                lines.append(f"- [ ] {a.strip()}")
    return "\n".join(lines).strip()




async def build_notion_markdown(
    db: Session,
    *,
    session_id: int,
    template: TemplateType,
    use_qwen_for_final: bool = True,
    ) -> Dict[str, Any]:
    """
    세 가지 소스에서 데이터를 분리 취합하여 노션에 올릴 Markdown 본문을 생성한다.
    - script : recording_embeddings.text_chunk 원문(정제 스크립트가 DB에 있다면 해당 형태 리스트를 넣어도 됨)
    - minutes : summaries.content (문단 + 요약)
    - final : final_summaries.{title, bullets, actions} (없으면 qwen으로 생성)
    """
    if template == "script":
        # 1) text_chunk -> 단일 본문으로
        chunks = get_text_chunks_by_session(db, session_id=session_id) # -> List[str]
        merged = _merge_text_chunks(chunks)
        md = _render_script_markdown([{"speaker_label": "발언", "text": merged}])
        return {"title": "스크립트", "content": md}


    elif template == "minutes":
        # 2) summaries 테이블 기반 회의기록
        rows = get_summaries_by_session(db, session_id=session_id) # -> List[Summary]
        # Summary(row).content, row.summary 필드 고려
        serial = [
            {"content": getattr(r, "content", None), "summary": getattr(r, "summary", None)}
            for r in rows
    ]
        md = _render_minutes_markdown(serial)
        return {"title": "회의기록", "content": md}


    else: # template == "final"
        fs = get_final_summary_by_session(db, session_id=session_id)
        if fs and (fs.title or fs.bullets or fs.actions):
            title = fs.title or "회의 요약"
            bullets = fs.bullets or []
            actions = fs.actions or []
            md = _render_final_markdown(title, bullets, actions)
            return {"title": title, "content": md}


    # final_summaries 가 비어있으면 qwen으로 생성
    chunks = get_text_chunks_by_session(db, session_id=session_id)
    body = _merge_text_chunks(chunks, max_chars=16000)
    if use_qwen_for_final:
        j = await ollama_summarize_json(body)
        title = j.get("title") or "회의 요약"
        bullets = j.get("bullets") or []
        actions = j.get("actions") or []
        md = _render_final_markdown(title, bullets, actions)
        return {"title": title, "content": md, "raw": j}
    else:
        # 모델 미사용 fallback
        md = _render_final_markdown("회의 요약", [], [])
        return {"title": "회의 요약", "content": md}