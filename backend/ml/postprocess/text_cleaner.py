# backend/ml/postprocess/text_cleaner.py
from __future__ import annotations
import re
from typing import Sequence, Optional

class TextCleaner:
    """
    구어 -> 문어 전처리용 가벼운 파이프라인
    - 연속 문자 줄이기 (ㅎㅎㅎ/ㅋㅋㅋ/아아아 등)
    - n-gram 반복 압축
    - 불용어 제거
    - 공백 정리
    """
    def __init__(self, stopwords: Optional[list[str]] = None, ngram_size: int = 3):
        # 기본 불용어에 감탄/호응 계열을 **가볍게** 추가
        base_stop = ["감사합니다"]
        self.stopwords = (stopwords or []) + base_stop
        self.ngram_size = ngram_size

        # 라인에서 제거할 일반적 노이즈(괄호/대괄호 안 표기, 이모티콘류/웃음 등)
        self._noise_pat = re.compile(r"(\([^)]+\))|(\[[^\]]+\])")
        # 흔한 추임새/의성어(과도 억제는 지양, 완전 쓰레기 라인만 필터)
        self._filler_line_pat = re.compile(r"^\s*(?:아+|어+|음+|에+|흐+|하+|응+|헉+|아이+|으+|어흠+|음음+|ㅎ+|ㅋ+)\s*[.!?]*\s*$")

    def remove_char_runs(self, text: str) -> str:
        """같은 글자가 3번 이상 반복되는 경우 줄이기: ㅎㅎㅎ -> ㅎ, 아아아 -> 아"""
        return re.sub(r'(.)\1{2,}', r'\1', text)

    def remove_stopwords(self, text: str) -> str:
        """특정 불용어 제거"""
        for sw in self.stopwords:
            text = re.sub(rf'\b{re.escape(sw)}\b', '', text)
        return re.sub(r'\s+', ' ', text).strip()

    def remove_ngram_repeats(self, text: str, n: int | None = None) -> str:
        """n-gram 반복 구간 제거 (구어의 더듬이/반복 어절 완화)"""
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
        """한 문장(또는 한 줄) 전체 클린업"""
        if not text:
            return ""
        t = text.strip()

        # 괄호 표기류 제거
        t = self._noise_pat.sub("", t)

        # 연속된 점(.. ...) 제거
        t = re.sub(r"\.{2,}", "", t)

        # 문자 반복 정규화, ngram 반복 압축
        t = self.remove_char_runs(t)
        t = self.remove_ngram_repeats(t)

        # 불용어 제거 + 공백 정리
        t = self.remove_stopwords(t)

        return t.strip()

    def is_trivial_filler_line(self, text: str) -> bool:
        """의미가 거의 없는 순수 추임새/감탄/웃음만 있는 라인 필터"""
        return bool(self._filler_line_pat.match(text or ""))


def _is_low_value_line(s: str) -> bool:
    """너무 짧거나(2자 이하) 공허한 라인 필터"""
    if not s:
        return True
    s = s.strip()
    if len(s) < 3:
        return True
    return False


def normalize_transcript_lines(lines: Sequence[str], cleaner: Optional[TextCleaner] = None) -> list[str]:
    """
    녹취 라인들을 가볍게 정리:
    - 괄호/대괄호 내 표기 제거
    - 과도한 반복/더듬이 완화
    - 순수 추임새/웃음만 있는 라인 제거
    - 과도한 하드코딩 키워드 필터 없음(도메인 중립)
    """
    cleaner = cleaner or TextCleaner()
    out: list[str] = []
    for ln in lines:
        if not ln:
            continue
        if cleaner.is_trivial_filler_line(ln):
            continue
        t = cleaner.clean(ln)
        if _is_low_value_line(t):
            continue
        out.append(t)
    return out
