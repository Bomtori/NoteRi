# backend/ml/stt_model.py

from faster_whisper import WhisperModel
import io
import wave

class STTModel:
    
    def __init__(self, model_size="medium", device="cuda",
                 chunk_seconds=3.0, overlap_seconds=1.0, sample_rate=16000):
        print(f"🚀 FastWhisper {model_size} 모델 로딩 중... (device={device})")
        self.model = WhisperModel(
            model_size,
            device=device,
            compute_type="float16"  # GPU 최적화
        )
        print("✅ CUDA 모델 로딩 완료!")

        # === 슬라이딩 윈도우 설정 ===
        self.sample_rate = sample_rate
        self.CHUNK_SIZE = int(chunk_seconds * sample_rate)
        self.OVERLAP = int(overlap_seconds * sample_rate)

        self.pcm_buffer = b""

    def transcribe_chunk(self, pcm_bytes: bytes, return_segments: bool = False):
        """Whisper 모델로 음성을 텍스트 or segment 리스트로 변환"""
        if not pcm_bytes:
            return None

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(self.sample_rate)
            wf.writeframes(memoryview(pcm_bytes))
        buffer.seek(0)

        segments, _ = self.model.transcribe(
            buffer,
            language="ko",
            beam_size=5,
            best_of=5,
            temperature=0.2,
            vad_filter=False,
            condition_on_previous_text=True,
            word_timestamps=True,   # ✅ 꼭 켤 것
            patience=1.2,
            compression_ratio_threshold=2.4,
            no_speech_threshold=0.6
        )

        if return_segments:
            return list(segments)

        text = " ".join([seg.text.strip() for seg in segments if seg.text.strip()])
        return text.strip() if text else None

    def slide_buffer(self, pcm_buffer: bytes):
        """슬라이딩 윈도우: 일부 버퍼 남겨두기"""
        if len(pcm_buffer) >= self.CHUNK_SIZE:
            return pcm_buffer[self.CHUNK_SIZE - self.OVERLAP:]
        return pcm_buffer

    def feed(self, pcm_chunk: bytes, return_segments: bool = False):
        """
        PCM 청크를 누적하고,
        일정 길이 이상 쌓이면 Whisper로 변환 후 결과 반환.
        """
        self.pcm_buffer += pcm_chunk

        if len(self.pcm_buffer) >= self.CHUNK_SIZE:
            result = self.transcribe_chunk(self.pcm_buffer, return_segments=return_segments)
            self.pcm_buffer = self.slide_buffer(self.pcm_buffer)
            return result

        return None
