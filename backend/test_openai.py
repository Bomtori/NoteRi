import os
from openai import OpenAI
from dotenv import load_dotenv  # 👈 추가

# .env 파일 로드
load_dotenv()

# 환경변수 읽기
api_key = os.getenv("OPENAI_API_KEYS")
if not api_key:
    raise ValueError("⚠️ OPENAI_API_KEYS not found in environment variables!")

# OpenAI 클라이언트 생성
client = OpenAI(api_key=api_key)  # ✅ 단수형 key

# 간단한 요청 테스트
resp = client.responses.create(
    model="gpt-4.1-mini",
    input="Say hello in Korean in 5 words."
)

print(resp.output_text)
