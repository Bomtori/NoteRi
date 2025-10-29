# ============================================
# backend/ml/preprocessing/realtime_cleaner.py
# ============================================
import re
from .typo_corrector import TypoCorrector

class RealtimeCleaner:
    """
    실시간 표시 전 전처리 (통합)
    - 기본 정리: 추임새, 웃음, 반복 제거
    - 오타 수정: TypoCorrector 사용
    """
    def __init__(self, use_typo_correction: bool = True):
        # 제거할 패턴들
        self.filler_pattern = re.compile(
            r'\b(아+|어+|음+|에+|으+|어흠+|그+|뭐+|저+)\b'
        )
        self.laugh_pattern = re.compile(
            r'\b(ㅎ+|ㅋ+|하하+|호호+|히히+)\b'
        )
        self.dots_pattern = re.compile(r'\.{2,}')
        
        # 오타 수정기 (선택적)
        self.typo_corrector = TypoCorrector() if use_typo_correction else None
    
    def clean(self, text: str) -> str:
        """전체 전처리 파이프라인"""
        if not text or not text.strip():
            return ""
        
        t = text.strip()
        
        # 1. 연속 글자 줄이기
        t = re.sub(r'(.)\1{2,}', r'\1', t)
        
        # 2. 추임새 제거
        t = self.filler_pattern.sub('', t)
        
        # 3. 웃음 제거
        t = self.laugh_pattern.sub('', t)
        
        # 4. 연속 점 제거
        t = self.dots_pattern.sub('', t)
        
        # 5. 반복 단어 제거
        t = self._remove_word_repeats(t)
        
        # 6. 불완전한 단어 제거
        t = self._remove_incomplete_words(t)
        
        # 7. ✅ 오타 자동 수정 (TypoCorrector 사용)
        if self.typo_corrector:
            t = self.typo_corrector.correct(t)
        
        # 8. 공백 정리
        t = re.sub(r'\s+', ' ', t)
        
        return t.strip()
    
    def _remove_word_repeats(self, text: str) -> str:
        """반복 단어 제거"""
        words = text.split()
        if len(words) <= 1:
            return text
        
        result = [words[0]]
        for i in range(1, len(words)):
            if words[i] != words[i-1]:
                result.append(words[i])
        
        return ' '.join(result)
    
    def _remove_incomplete_words(self, text: str) -> str:
        """불완전한 단어 제거 (끝에 '..' 있는 경우)"""
        words = text.split()
        result = []
        
        for word in words:
            if '..' in word:
                continue
            result.append(word)
        
        return ' '.join(result)
