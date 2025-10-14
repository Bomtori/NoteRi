# backend/app/util/gemini_client.py
import os, json, time
from functools import lru_cache
import httpx
from google import genai
from google.genai import types as gt
from httpx import ReadTimeout, ConnectTimeout, HTTPStatusError

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

@lru_cache(maxsize=1)
def get_gemini_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY가 없습니다.")
    return genai.Client(api_key=api_key)

def _extract_parts_text(parts) -> str:
    out = []
    for p in parts or []:
        t = getattr(p, "text", None)
        if t:
            out.append(t)
    return "".join(out)

def _extract_text_models(resp) -> str:
    if getattr(resp, "text", None):
        return resp.text or ""
    try:
        for c in getattr(resp, "candidates", []) or []:
            content = getattr(c, "content", None)
            parts = getattr(content, "parts", []) if content else []
            s = _extract_parts_text(parts)
            if s:
                return s
    except Exception:
        pass
    return ""

def _extract_text_responses(resp) -> str:
    txt = (getattr(resp, "output_text", "") or "").strip()
    if txt:
        return txt
    try:
        for c in getattr(resp, "candidates", []) or []:
            content = getattr(c, "content", None)
            parts = getattr(content, "parts", []) if content else []
            s = _extract_parts_text(parts)
            if s:
                return s
    except Exception:
        pass
    return ""

def _rest_generate_content(prompt: str, model: str, api_key: str, *, timeout=None, retries=2) -> tuple[str, dict]:
    """
    SDK 경로가 비었을 때 마지막 폴백.
    - httpx Timeout/재시도
    - 항상 (text, meta) 튜플 반환 (실패 시 ("", {...}))
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    params = {"key": api_key}
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}

    # 보수적 타임아웃 (read를 넉넉히)
    tmo = timeout or httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=60.0)
    limits = httpx.Limits(max_keepalive_connections=10, max_connections=20)

    last_err = None
    for attempt in range(retries + 1):
        try:
            with httpx.Client(timeout=tmo, limits=limits) as cli:
                resp = cli.post(url, params=params, headers=headers, json=payload)
                resp.raise_for_status()  # 4xx/5xx -> HTTPStatusError
                data = resp.json()
                # 텍스트 추출
                cands = data.get("candidates") or []
                for c in cands:
                    content = (c or {}).get("content") or {}
                    parts = content.get("parts") or []
                    texts = [p.get("text") for p in parts if isinstance(p, dict) and p.get("text")]
                    if texts:
                        return "".join(texts).strip(), {"api": "rest", "model": model, "status": resp.status_code}
                # 후보가 비어도 메타 반환
                return "", {"api": "rest", "model": model, "status": resp.status_code, "note": "no candidates"}
        except (ReadTimeout, ConnectTimeout) as e:
            last_err = f"timeout: {type(e).__name__}"
        except HTTPStatusError as e:
            # 404는 모델 미지원, 401/403은 키/권한 문제
            status = e.response.status_code if e.response else None
            return "", {"api": "rest", "model": model, "error": f"http {status}"}
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"

        # 재시도 백오프 (간단)
        if attempt < retries:
            time.sleep(0.4 * (attempt + 1))

    return "", {"api": "rest", "model": model, "error": last_err or "unknown"}
def generate_text(prompt: str, *, temperature: float = 0.3, max_output_tokens: int = 256):
    """
    1) Responses API → 2) Models API → 3) REST 폴백
    항상 (text, meta) 반환
    """
    client = get_gemini_client()
    api_key = os.getenv("GEMINI_API_KEY")
    model = DEFAULT_MODEL

    cfg = gt.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max(128, max_output_tokens),
        candidate_count=1,
        # 운영 기본 안전성(필요시 조정)
        safety_settings=[
            gt.SafetySetting(category="HARM_CATEGORY_HARASSMENT",        threshold="BLOCK_ONLY_HIGH"),
            gt.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",       threshold="BLOCK_ONLY_HIGH"),
            gt.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_ONLY_HIGH"),
            gt.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_ONLY_HIGH"),
        ],
    )

    # 1) Responses API
    try:
        # noinspection PyUnresolvedReferences
        r1 = client.responses.generate(model=model, input=prompt, config=cfg)
        t1 = _extract_text_responses(r1).strip()
        if t1:
            return t1, {"api": "responses", "model": model}
    except Exception:
        pass

    # 2) Models API
    try:
        r2 = client.models.generate_content(model=model, contents=prompt, config=cfg)
        t2 = _extract_text_models(r2).strip()
        if t2:
            return t2, {"api": "models", "model": model}
    except Exception:
        pass

    # 3) REST 폴백
    t3, m3 = _rest_generate_content(prompt, model, api_key)
    if t3:
        return t3, m3
    # 여기서도 터뜨리지 말고 "빈 응답 + 메타"로 반환
    return "", m3 | {"api": m3.get("api", "none")}
