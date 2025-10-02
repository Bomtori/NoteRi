import torch
import numpy as np
from ..config import VAD_THRESHOLD, VAD_SAMPLE_RATE

class VADFilter:
    def __init__(self, threshold=VAD_THRESHOLD, sampling_rate=VAD_SAMPLE_RATE):
        """
        Silero VAD를 활용한 음성 감지 필터
        - threshold: 감지 민감도 (낮으면 더 민감하게 탐지)
        - sampling_rate: 오디오 샘플링 레이트
        """
        print("🚀 Silero VAD (CPU) 로딩 중...")
        self.model, self.utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            force_reload=False,
            trust_repo=True,
        )
        (self.get_speech_timestamps,
         self.save_audio,
         self.read_audio,
         self.VADIterator,
         self.collect_chunks) = self.utils

        self.sampling_rate = sampling_rate
        self.threshold = threshold
        self.device = "cpu"
        print(f"✅ VAD (CPU) 로딩 완료! threshold={self.threshold}, sr={self.sampling_rate}")

    def has_speech(self, pcm_bytes: bytes) -> bool:
        """
        입력 PCM 데이터에서 음성이 포함돼 있는지 확인
        """
        if not pcm_bytes:
            return False

        pcm_array = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32)
        if pcm_array.size == 0:
            return False
        pcm_array = pcm_array / 32768.0
        pcm_tensor = torch.from_numpy(pcm_array).to(self.device)

        try:
            speech_timestamps = self.get_speech_timestamps(
                pcm_tensor,
                self.model,
                sampling_rate=self.sampling_rate
            )
            return len(speech_timestamps) > 0
        except Exception as e:
            print(f"❌ VAD 오류: {e}")
            return False
