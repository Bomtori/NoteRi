import re

class TextCleaner:
    def __init__(self, stopwords=None, ngram_size=3):
        self.stopwords = stopwords or ["감사합니다"]
        self.ngram_size = ngram_size

    def remove_char_runs(self, text: str) -> str:
        """같은 글자가 3번 이상 반복되는 경우 줄이기"""
        return re.sub(r'(.)\1{2,}', r'\1', text)

    def remove_stopwords(self, text: str) -> str:
        """특정 불용어 제거"""
        for sw in self.stopwords:
            text = re.sub(rf'\b{re.escape(sw)}\b', '', text)
        return re.sub(r'\s+', ' ', text).strip()

    def remove_ngram_repeats(self, text: str, n: int = None) -> str:
        """n-gram 반복 구간 제거"""
        if n is None:
            n = self.ngram_size
        tokens = text.split()
        if len(tokens) < n * 2:
            return text
        out, i = [], 0
        while i < len(tokens):
            out.append(tokens[i])
            if i >= n and i + n <= len(tokens):
                prev_ngram = tokens[i-n+1:i+1]
                next_ngram = tokens[i+1:i+1+n]
                if prev_ngram == next_ngram:
                    i += n
                    continue
            i += 1
        return " ".join(out)

    def clean(self, text: str) -> str:
        """전체 클린업 파이프라인"""
        if not text:
            return ""
        t = text.strip()
        # 연속된 점(.. ...) 모두 제거
        t = re.sub(r"\.{2,}", "", t)
        t = self.remove_char_runs(t)
        t = self.remove_ngram_repeats(t)
        t = self.remove_stopwords(t)
        return t
