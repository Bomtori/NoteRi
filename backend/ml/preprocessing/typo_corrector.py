# ============================================
# backend/ml/preprocessing/typo_corrector.py
# ============================================
import json
import os
import re
from typing import Dict

class TypoCorrector:
    """
    STT 오타 자동 수정기
    - 외부 JSON 파일에서 오타 사전 로드
    - 코드 수정 없이 사전만 업데이트 가능
    """
    def __init__(self, dict_path: str = None):
        if dict_path is None:
            # 기본 경로: 같은 디렉토리의 config/typo_dict.json
            base_dir = os.path.dirname(os.path.abspath(__file__))
            dict_path = os.path.join(base_dir, "config", "typo_dict.json")
        
        self.typo_dict = self._load_dict(dict_path)
    
    def _load_dict(self, path: str) -> Dict[str, str]:
        """오타 사전 로드"""
        if not os.path.exists(path):
            print(f"⚠️ Typo dict not found: {path}, using empty dict")
            return {}
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ Failed to load typo dict: {e}")
            return {}
    
    def correct(self, text: str) -> str:
        """오타 자동 수정"""
        if not text or not self.typo_dict:
            return text
        
        result = text
        for wrong, correct in self.typo_dict.items():
            # 단어 경계 사용 (부분 매칭 방지)
            pattern = rf'\b{re.escape(wrong)}\b'
            result = re.sub(pattern, correct, result, flags=re.IGNORECASE)
        
        return result