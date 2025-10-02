# config.py

# === Summarizer 관련 설정 ===
SUMMARIZER_PROMPT = "요약 후 문맥에 맞게 수정\n"
SUMMARIZER_MAX_LENGTH = 100
SUMMARIZER_MIN_LENGTH = 30

# === VAD 관련 설정 ===
VAD_THRESHOLD = 0.35   # 음성 감지 민감도 (낮출수록 더 민감)
VAD_SAMPLE_RATE = 16000

