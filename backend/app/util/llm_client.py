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

TEMPLATE_PROMPTS = {
    "lecture": """
당신은 한국어 전문 강의록 작성 보조 AI입니다.
반드시 한국어만 사용하세요.

다음 자료를 기반으로 "강의록 형태" 문서를 작성하세요.
- 구어체를 모두 문어체로 변환
- 불필요한 말투 제거
- 핵심 내용 구조화
- 강의 구성 순서에 맞게 흐름 재정렬
- 예시, 설명, 결론을 명확하게 정리

출력 형식 (Markdown):
# 강의 제목
## 1. 강의 개요
- 강의 주제 요약

## 2. 핵심 내용
- 핵심 개념 4~8개 정리
- 설명 포함

## 3. 세부 내용 정리
### ● 개념 A
- 설명
- 관련 맥락

### ● 개념 B
- 설명
- 관련 맥락

## 4. 결론 및 정리
- 전체 요약 3~5줄

자료:
요약본:
{summaries}

정제된 스크립트:
{script}

메모:
{memo}
""",

    "meeting": """
당신은 한국어 전문 회의록 작성 AI입니다.
반드시 한국어만 사용하세요.

다음 자료로부터 "전문 회의록"을 작성하세요.
- 구어체 제거, 문어체 변환
- 의사결정 사항, 작업 항목 분리
- 발언 순서보다 의미 기준으로 재정렬

출력 형식 (Markdown):
# 회의록
## 1. 회의 개요
- 날짜/시간/주제 요약 (날짜는 입력 자료에 없으면 생략)

## 2. 주요 논의 내용
- 핵심 논의 4~7개, 불릿 포인트

## 3. 결정 사항
- 실제 결정된 항목만 추출

## 4. Action Items
- 담당자/해야할 일 형태로 간단 정리

## 5. 참고 메모
- Users memo 내용 반영

자료:
요약본:
{summaries}

스크립트:
{script}

사용자 메모:
{memo}
""",

    "interview": """
당신은 한국어 인터뷰 변환 전문가입니다.
반드시 한국어만 사용하세요.

다음 자료를 기반으로 “인터뷰 기사 형태”로 재작성하세요.
- 질문/답변 구조 재구성
- 불필요한 음성적 표현 삭제
- 핵심만 명확히 정리
- 실제 기사처럼 자연스럽게 재서술

출력 형식 (Markdown):
# 인터뷰 기사 제목

## 인터뷰 개요
- 인터뷰 주제 요약

## 주요 질문 & 답변
### Q1. 질문 내용
A1. 답변 요약 및 핵심 설명

### Q2. 질문 내용
A2. 답변 요약

(가능한 질문/답변을 3~8개 작성)

## 인터뷰 결론
- 핵심 메시지 정리 3~4줄

자료:
요약본:
{summaries}

스크립트:
{script}

메모:
{memo}
""",

    "blog": """
당신은 한국어 블로그 콘텐츠 생성 AI입니다.
반드시 한국어만 작성하세요.

다음 자료를 기반으로 “블로그 포스팅”을 작성하세요.
- 자연스럽고 읽기 쉬운 글
- 인트로 → 본문 → 결론 구조
- 핵심 메시지 강조
- 너무 딱딱하지 않게 구성

출력 형식 (Markdown):
# 블로그 글 제목

## intro
- 주제 소개
- 문제 제기 or 배경 설명

## 본문
### 1) 핵심 내용 1
- 설명

### 2) 핵심 내용 2
- 설명

### 3) 추가적으로 중요한 포인트
- 설명

## 마무리
- 전체 정리
- 독자에게 전달하고 싶은 메시지 2~3줄

자료:
요약본:
{summaries}

스크립트:
{script}

사용자 메모:
{memo}
""",
}

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

async def ollama_generate_template(template_type: str, summaries, script, memo, num_ctx: int = 8192) -> str:
    """
    템플릿 생성 API - 강의록/회의록/인터뷰/블로그 컨텐츠 자동생성
    """
    if template_type not in TEMPLATE_PROMPTS:
        raise ValueError(f"Unknown template type: {template_type}")

    prompt = TEMPLATE_PROMPTS[template_type].format(
        summaries=json.dumps(summaries, ensure_ascii=False, indent=2),
        script=json.dumps(script, ensure_ascii=False, indent=2),
        memo=json.dumps(memo, ensure_ascii=False, indent=2),
    )

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "num_ctx": num_ctx,
            "temperature": 0.3,
            "top_p": 0.9,
        },
    }

    async with httpx.AsyncClient(timeout=180) as client:
        r = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
        r.raise_for_status()
        return r.json().get("response", "").strip()