# backend/app/util/llm_client.py

import os, json, httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct-q4_K_M")

# ✅ 최종 요약용 프롬프트 (변경 없음)
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

# ✅ 1분 구간 요약용 프롬프트 (강화됨!)
INTERVAL_SUMMARY_PROMPT = """You are a Korean meeting assistant. You MUST respond ONLY in Korean.
절대로 영어, 중국어, 일본어 사용 금지. 오직 한국어로만 작성.

다음 대화를 2~3개의 짧은 불릿 포인트로 요약하세요.
각 불릿은 '• '로 시작하고, 한 문장으로 끝내세요.
구어체를 문서체로 바꾸고, 실제 말한 내용만 요약하세요.
추가 해석, 감정, 상상, 비유 금지. 오직 사실만.

형식:
• [동작/결정/제안]
• [동작/결정/제안]
• [동작/결정/제안]

예시 입력:
"안녕, 잘 지냈어? 우리 다음 주에 밥이나 먹자. 내가 쏠게!"

예시 출력:
• 인사 진행
• 안부 확인
• 밥 약속 제안

예시 입력:
"야 용정 화면 꺼야 돼. 파스타 먹을까? 가위바위보로 정하자!"

예시 출력:
• 용정 화면 제거 제안
• 파스타 메뉴 선정
• 가위바위보 결정 방식 제안

대화:
---
{text}
---

요약 (한국어만):"""


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
            "temperature": 0.1,     # ← 더 낮춤 (창의성 억제)
            "num_predict": 120,     # ← 최대 120토큰 (3줄 이하 강제)
            "top_p": 0.7,           # ← 덜 랜덤
        },
    }
    
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
            r.raise_for_status()
            summary = r.json().get("response", "").strip()
            
            # 후처리 (기존 유지 + 간단 보완)
            summary = _clean_interval_summary(summary)
            
            # • 가 포함되고, 2~3줄인지 확인
            lines = [l for l in summary.split('\n') if l.strip().startswith('• ')]
            if 2 <= len(lines) <= 3:
                return '\n'.join(lines)
            elif lines:
                return '\n'.join(lines[:3])
            else:
                # fallback: 문장 분리
                sentences = [s.strip() for s in text.replace('?', '.').replace('!', '.').split('.') if s.strip()][:3]
                return '\n'.join(f"• {s}" for s in sentences) if sentences else f"• {text[:80]}"
                
    except Exception as e:
        import logging
        logging.warning(f"Interval summary failed: {e}")
        sentences = [s.strip() for s in text.replace('?', '.').replace('!', '.').split('.') if s.strip()][:3]
        return '\n'.join(f"• {s}" for s in sentences) if sentences else f"• {text[:80]}"


def _clean_interval_summary(text: str) -> str:
    """요약 후처리 (기존 + 간단 보완)"""
    patterns_to_remove = [
        "첫 번째", "두 번째", "세 번째", "핵심 내용", "요약", "입니다", "입니다.", "다.", "다",
        "为了", "我将", "：", "1.", "2.", "3.", "••", "bullet", "point"
    ]
    
    result = text
    for pattern in patterns_to_remove:
        result = result.replace(pattern, "")
    
    # 중국어 제거
    import re
    result = re.sub(r'[\u4e00-\u9fff]+', '', result)
    result = re.sub(r'\s+', ' ', result).strip()
    
    # • 정리
    lines = []
    for line in result.split('\n'):
        line = line.strip()
        if line.startswith('•'):
            line = '• ' + line[1:].strip()
        elif line and not line.startswith('•'):
            line = '• ' + line
        if line != '• ' and len(line) > 5:
            lines.append(line)
    
    return '\n'.join(lines[:3])