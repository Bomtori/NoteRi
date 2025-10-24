import os, json, httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct-q4_K_M")

PROMPT = """다음은 회의 전체 기록입니다.
구어체를 문서체로 정리하고, 아래 JSON 형식으로만 응답하세요.

{"title": "...", "bullets": ["...", "..."], "actions": ["...", "..."]}

요구:
- title: 한 줄 요약 제목
- bullets: 핵심 내용 (중복·불필요 표현 제거)
- actions: 후속 조치 항목 0~5개

회의록:
---
{body}
---
"""

async def ollama_summarize_json(body: str, num_ctx: int = 8192) -> dict:
    """Ollama API로 요약 JSON을 요청"""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": PROMPT.format(body=body),
        "stream": False,
        "options": {"num_ctx": num_ctx, "temperature": 0.3},
    }
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
        r.raise_for_status()
        text = r.json().get("response", "").strip()
    try:
        return json.loads(text)
    except Exception:
        s, e = text.find("{"), text.rfind("}")
        if s != -1 and e != -1 and e > s:
            return json.loads(text[s:e + 1])
        raise
