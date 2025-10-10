# backend/ml/postprocess/silence_segmenter.py

from .text_cleaner import TextCleaner

class SilenceSegmenter:
    def __init__(self, silence_limit: float = 1.5, chunk_seconds: float = 1.0, ngram_size: int = 3):
        self.buffer = ""
        self.silence_time = 0.0
        self.silence_limit = float(silence_limit)
        self.chunk_seconds = float(chunk_seconds)
        self.cleaner = TextCleaner(ngram_size=ngram_size)

    def feed(self, text: str = None, is_silence: bool = False):
        if not is_silence and text:
            # 실시간은 최대한 '있는 그대로' 누적 (Deduper가 중복을 제거함)
            if text.strip():
                self.buffer += (" " + text.strip()) if self.buffer else text.strip()
            self.silence_time = 0.0
            return self.buffer.strip(), None

        # 무음 처리
        self.silence_time += self.chunk_seconds
        if self.silence_time >= self.silence_limit and self.buffer.strip():
            finalized = self.cleaner.clean(self.buffer.strip())
            finalized = self.cleaner.remove_ngram_repeats(finalized, max(1, self.cleaner.ngram_size - 1))
            finalized = self.cleaner.remove_char_runs(finalized)
            self.buffer = ""
            self.silence_time = 0.0
            return "", finalized

        return self.buffer.strip(), None
