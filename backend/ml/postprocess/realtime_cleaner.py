# backend/ml/postprocess/realtime_cleaner.py

import re

class RealtimeCleaner:
    """
    실시간 표시 전 가벼운 전처리
    - STT 직후 적용하여 사용자에게 깨끗한 텍스트 표시
    - Segmenter 이전에 실행됨
    """
    def __init__(self):
        # 제거할 패턴들
        self.filler_pattern = re.compile(r'\b(아+|어+|음+|에+|으+|어흠+)\b')
        self.laugh_pattern = re.compile(r'\b(ㅎ+|ㅋ+|하하+|호호+)\b')
        self.dots_pattern = re.compile(r'\.{2,}')  # ... 제거
        
    def clean(self, text: str) -> str:
        """
        실시간 텍스트 정리
        - 말더듬 제거 (아아아, 음음음)
        - 웃음 제거 (ㅋㅋㅋ, ㅎㅎㅎ)
        - 반복 단어 제거
        - 연속 점 제거 (...)
        """
        if not text or not text.strip():
            return ""
        
        t = text.strip()
        
        # 1. 연속된 같은 글자 줄이기 (아아아 → 아, ㅋㅋㅋ → ㅋ)
        t = re.sub(r'(.)\1{2,}', r'\1', t)
        
        # 2. 추임새 제거 (아, 음, 어 등)
        t = self.filler_pattern.sub('', t)
        
        # 3. 웃음 제거 (ㅋ, ㅎ, 하하 등)
        t = self.laugh_pattern.sub('', t)
        
        # 4. 연속 점 제거 (... → 공백)
        t = self.dots_pattern.sub('', t)
        
        # 5. 반복 단어 제거 (같은 단어가 2번 이상 연속)
        t = self._remove_word_repeats(t)
        
        # 6. 여러 공백을 하나로
        t = re.sub(r'\s+', ' ', t)
        
        # 7. 앞뒤 공백 제거
        return t.strip()
    
    def _remove_word_repeats(self, text: str) -> str:
        """
        같은 단어가 연속으로 나오면 하나만 남김
        예: "그거 그거 말이야" → "그거 말이야"
        """
        words = text.split()
        if len(words) <= 1:
            return text
        
        result = [words[0]]
        for i in range(1, len(words)):
            # 이전 단어와 다르면 추가
            if words[i] != words[i-1]:
                result.append(words[i])
        
        return ' '.join(result)