# backend/test_openai.py
import os
import pytest

from backend.app.util.gemini_client import get_gemini_client, generate_text

@pytest.fixture(autouse=True)
def _force_mock_mode(monkeypatch):
    # 테스트는 외부 API에 의존하지 않도록 항상 모의 모드 강제
    monkeypatch.setenv("GEMINI_TEST_MODE", "mock")

def test_chat_basic():
    """
    외부 API(키/리전/쿼터)에 의존하지 않는 단위 테스트.
    MOCK 모드에서 'pong' 프롬프트에 정확히 'pong'이 돌아와야 함.
    """
    # 키가 없어도 모의 모드에서는 get_gemini_client()가 동작하게 구현됨
    client = get_gemini_client()
    assert client is not None

    out = generate_text("Reply exactly with: pong.", temperature=0.0, max_output_tokens=16).strip()
    print("MODEL OUT:", repr(out))
    assert out.lower().startswith("pong")