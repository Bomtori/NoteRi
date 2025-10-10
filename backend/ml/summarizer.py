## backend/ml/summarizer.py

from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
from ..config import SUMMARIZER_PROMPT, SUMMARIZER_MAX_LENGTH, SUMMARIZER_MIN_LENGTH

class ThreeLineSummarizer:
    def __init__(self, model_name="eenzeenee/t5-base-korean-summarization", device="cuda"):
        print(f"🚀 한국어 요약 모델 로딩 중... ({model_name})")
        self.device = device if torch.cuda.is_available() else "cpu"

        # Tokenizer & Model 로드
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(self.device)

        print("✅ 요약 모델 로딩 완료!")

    def summarize(self, text: str) -> str:
        """
        입력 문단을 요약해주는 메서드
        - text: 원문 텍스트
        - return: 요약된 텍스트
        """
        if not text.strip():
            return ""

        # 📌 config.py에서 prompt 문자열 불러오기
        prompt = SUMMARIZER_PROMPT + text

        inputs = self.tokenizer(
            [prompt],
            max_length=512,
            truncation=True,
            return_tensors="pt"
        ).to(self.model.device)

        summary_ids = self.model.generate(
            inputs["input_ids"],
            num_beams=4,
            max_length=SUMMARIZER_MAX_LENGTH,
            min_length=SUMMARIZER_MIN_LENGTH,
            length_penalty=1.5,
            no_repeat_ngram_size=3
        )

        summary_text = self.tokenizer.decode(summary_ids[0], skip_special_tokens=True)

        return summary_text.strip()
