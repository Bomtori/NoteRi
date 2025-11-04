# backend/app/util/llm_client.py

import os, json, httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct-q4_K_M")

# ✅ 최종 요약용 프롬프트 (한국어 강제)
FINAL_SUMMARY_PROMPT = """You are a Korean meeting assistant. You MUST respond ONLY in Korean language.

다음은 회의 전체 기록입니다.
구어체를 문서체로 정리하고, 아래 JSON 형식으로만 응답하세요.
반드시 한국어로만 작성하세요. 중국어, 영어, 일본어 사용 금지.

{{"title": "...", "bullets": ["...", "..."], "actions": ["...", "..."]}}

요구사항:
- title: 한 줄 요약 제목 (한국어)
- bullets: 핵심 내용 2-5개 (한국어, 중복 제거)
- actions: 후속 조치 항목 0-5개 (한국어)
- 반드시 한국어로만 작성

회의록:
---
{body}
---

JSON (한국어로만):"""

# ✅ 1분 구간 요약용 프롬프트 (한국어 강제)
INTERVAL_SUMMARY_PROMPT = """You are a Korean assistant. Respond ONLY in Korean.

다음 대화를 한국어로 2-3개 불릿 포인트로 요약하세요.
절대로 중국어, 일본어를 사용하지 마세요.

규칙:
- 반드시 한국어로만 작성
- 각 불릿은 '• '로 시작 (공백 포함)
- 구어체를 문서체로 변환
- "첫 번째", "두 번째" 같은 서수 제거
- 간결하게 1-2문장

예시:
• STT 파이프라인 요약 주기를 1분으로 설정
• 세션 종료 시 최종 요약만 별도 저장
• 보드 생성 실패 시 폴백 로직 구현

대화:
---
{text}
---

요약 (한국어):"""


async def ollama_summarize_json(body: str, num_ctx: int = 8192) -> dict:
    """
    최종 요약: Ollama API로 구조화된 JSON 요약 생성
    """
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": FINAL_SUMMARY_PROMPT.format(body=body),
        "stream": False,
        "options": {
            "num_ctx": num_ctx,
            "temperature": 0.3,
            "top_p": 0.9,
        },
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


async def ollama_summarize_interval(text: str, num_ctx: int = 2048) -> str:
    """
    1분 구간 요약: 한국어 불릿 포인트 생성
    """
    if not text or len(text.strip()) < 50:
        import logging
        logging.info(f"Text too short ({len(text)} chars), skipping summary")
        return f"• {text.strip()}" if text.strip() else ""
    
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": INTERVAL_SUMMARY_PROMPT.format(text=text),
        "stream": False,
        "options": {
            "num_ctx": num_ctx,
            "temperature": 0.3,
            "num_predict": 200,
            "top_p": 0.9,
        },
    }
    
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
            r.raise_for_status()
            summary = r.json().get("response", "").strip()
            
            # 후처리
            summary = _clean_interval_summary(summary)
            
            if summary and "•" in summary:
                return summary
            else:
                lines = [ln.strip() for ln in text.split('.') if ln.strip()]
                return "• " + "\n• ".join(lines[:3]) if lines else f"• {text[:100]}"
                
    except Exception as e:
        import logging
        logging.warning(f"Interval summary failed: {e}")
        lines = [ln.strip() for ln in text.split('.') if ln.strip()]
        return "• " + "\n• ".join(lines[:3]) if lines else f"• {text[:100]}"


def _clean_interval_summary(text: str) -> str:
    """요약 후처리"""
    patterns_to_remove = [
        "첫 번째 핵심 내용:", "두 번째 핵심 내용:", "세 번째 핵심 내용:",
        "첫 번째:", "두 번째:", "세 번째:",
        "핵심 내용:", "요약:",
        "为了使回答更符合要求", "我将", "：",  # 중국어 패턴 제거
    ]
    
    result = text
    for pattern in patterns_to_remove:
        result = result.replace(pattern, "")
    
    # 중국어 문자 제거
    import re
    result = re.sub(r'[\u4e00-\u9fff]+', '', result)
    
    # 여러 공백을 하나로
    result = re.sub(r'\s+', ' ', result)
    
    # 각 라인 정리
    lines = []
    for line in result.split('\n'):
        line = line.strip()
        if line.startswith('•'):
            if len(line) > 1 and line[1] != ' ':
                line = '• ' + line[1:].strip()
            lines.append(line)
    
    return '\n'.join(lines)