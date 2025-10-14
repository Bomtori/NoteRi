# backend/ml/vad.py

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
        self.threshold = float(threshold)
        self.device = "cpu"

        # ★ 파라미터 저장
        self.min_speech_duration_ms = int(min_speech_duration_ms)
        self.min_silence_duration_ms = int(min_silence_duration_ms)
        self.speech_pad_ms = int(speech_pad_ms)
        self.max_speech_duration_s = float(max_speech_duration_s)

        print(
            f"✅ VAD (CPU) 로딩 완료! "
            f"threshold={self.threshold}, sr={self.sampling_rate}, "
            f"min_sil={self.min_silence_duration_ms}ms, pad={self.speech_pad_ms}ms"
        )

    def has_speech(self, pcm_bytes: bytes) -> bool:
        """
        입력 PCM 데이터에서 음성이 포함돼 있는지 확인
        (실시간 스트림에 적합: 패딩/끝 판단 지연 적용)
        """
        if not pcm_bytes:
            return False

        pcm_array = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32)
        if pcm_array.size == 0:
            return False
        pcm_array = pcm_array / 32768.0
        pcm_tensor = torch.from_numpy(pcm_array).to(self.device)

        try:
            # ★ 핵심: pad/지연/최대길이 파라미터 적용
            speech_timestamps = self.get_speech_timestamps(
                pcm_tensor,
                self.model,
                sampling_rate=self.sampling_rate,
                threshold=self.threshold,
                min_speech_duration_ms=self.min_speech_duration_ms,
                min_silence_duration_ms=self.min_silence_duration_ms,
                speech_pad_ms=self.speech_pad_ms,
                return_seconds=False,
                max_speech_duration_s=self.max_speech_duration_s,
            )
            return len(speech_timestamps) > 0
        except Exception as e:
            print(f"❌ VAD 오류: {e}")
            return False
