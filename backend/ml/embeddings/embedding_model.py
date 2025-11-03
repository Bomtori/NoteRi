"""
backend/ml/embeddings/embedding_model.py
한국어 텍스트를 벡터로 변환
"""

from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Tuple
import re


class KoreanEmbedder:
    """한국어 특화 임베딩 모델"""
    
    def __init__(self, model_name: str = "jhgan/ko-sbert-nli"):
        """
        Args:
            model_name: HuggingFace 모델 이름 (기본: 한국어 특화 모델)
        """
        print(f"📥 임베딩 모델 로딩 중: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.dimension = 768  # ko-sbert-nli 출력 차원
        print("✅ 임베딩 모델 로딩 완료!")
        
    def embed_text(self, text: str) -> np.ndarray:
        """
        단일 텍스트를 벡터로 변환
        
        Args:
            text: 입력 텍스트
            
        Returns:
            768차원 벡터
        """
        embedding = self.model.encode(text, convert_to_numpy=True)
        return embedding
    
    def embed_batch(self, texts: List[str]) -> List[np.ndarray]:
        """
        여러 텍스트를 한 번에 벡터로 변환 (효율적)
        
        Args:
            texts: 입력 텍스트 리스트
            
        Returns:
            벡터 리스트
        """
        if not texts:
            return []
        
        embeddings = self.model.encode(
            texts, 
            convert_to_numpy=True, 
            show_progress_bar=True
        )
        return [emb for emb in embeddings]
    
    def chunk_text(
        self, 
        text: str, 
        chunk_size: int = 500, 
        overlap: int = 50
    ) -> List[Tuple[str, int]]:
        """
        긴 텍스트를 검색 가능한 작은 조각으로 분할
        
        Args:
            text: 전체 텍스트
            chunk_size: 한 조각의 최대 글자 수
            overlap: 조각 간 겹치는 글자 수 (문맥 유지)
            
        Returns:
            [(텍스트 조각, 인덱스), ...]
        """
        if not text or not text.strip():
            return []
        
        # 문장 단위로 분리 (한글 마침표, 느낌표, 물음표 포함)
        sentences = re.split(r'[.!?]\s+', text)
        
        chunks = []
        current_chunk = ""
        chunk_index = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # 현재 청크에 추가 가능한지 확인
            if len(current_chunk) + len(sentence) < chunk_size:
                current_chunk += sentence + ". "
            else:
                # 청크 저장
                if current_chunk:
                    chunks.append((current_chunk.strip(), chunk_index))
                    chunk_index += 1
                
                # 새 청크 시작 (overlap 적용)
                if overlap > 0 and current_chunk:
                    # 마지막 overlap 글자만큼 유지
                    current_chunk = current_chunk[-overlap:] + sentence + ". "
                else:
                    current_chunk = sentence + ". "
        
        # 마지막 청크 추가
        if current_chunk.strip():
            chunks.append((current_chunk.strip(), chunk_index))
        
        return chunks


# 싱글톤 인스턴스 (앱 전역에서 재사용)
_embedder_instance = None

def get_embedder() -> KoreanEmbedder:
    """임베더 싱글톤 가져오기"""
    global _embedder_instance
    if _embedder_instance is None:
        _embedder_instance = KoreanEmbedder()
    return _embedder_instance

def unload(self):
    """SentenceTransformer 내부 PyTorch 모델을 안전하게 언로드"""
    if hasattr(self.model, "cpu"):   # SentenceTransformer는 .cpu() 로 이동 후 del 가능
        self.model = self.model.cpu()
    # 내부 torch.nn.Module 은 자동으로 해제됩니다.