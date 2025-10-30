# backend/ml/diarization/diarization_model.py
from __future__ import annotations
import os
import torch
import torchaudio
import logging
from typing import List, Tuple
from pyannote.audio import Pipeline

logger = logging.getLogger(__name__)

def _to_mono_16k(waveform: torch.Tensor, sample_rate: int) -> tuple[torch.Tensor, int]:
    # [channels, time] → mono
    if waveform.ndim == 2 and waveform.size(0) > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    target_sr = 16000
    if sample_rate != target_sr:
        resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=target_sr)
        waveform = resampler(waveform)
        sample_rate = target_sr
    return waveform, sample_rate


class DiarizationModel:
    _instance: "DiarizationModel | None" = None

    @classmethod
    def get(cls) -> "DiarizationModel":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        # ✅ 안전한 환경변수 로딩
        token = os.getenv("HF_TOKEN")
        model_id = os.getenv("PYANNOTE_MODEL_ID", "pyannote/speaker-diarization-community-1")
        revision = os.getenv("PYANNOTE_REVISION", None)

        if not token:
            logger.error("❌ HF_TOKEN is missing. Please set it in your .env file.")
            # 예외 대신 안전한 폴백 (모델 로드 안 함)
            self.pipeline = None
            return

        try:
            logger.info(f"🔊 Loading diarization model: {model_id}{'@' + revision if revision else ''}")
            self.pipeline = Pipeline.from_pretrained(
                model_id,
                use_auth_token=token,  # ✅ pyannote 최신 버전은 이 이름 권장
                revision=revision
            )

            if torch.cuda.is_available():
                self.pipeline.to(torch.device("cuda"))
                logger.info("✅ Loaded diarization model on CUDA")
            else:
                logger.info("✅ Loaded diarization model on CPU")

        except Exception as e:
            logger.error(f"❌ Failed to load diarization model: {e}")
            self.pipeline = None  # 안전한 폴백

    def infer_file(self, wav_path: str, **kwargs) -> List[Tuple[int, int, str]]:
        """Run diarization on an audio file. 반환: [(start_ms, end_ms, 'SPEAKER_00'), ...]"""
        if self.pipeline is None:
            raise RuntimeError("Diarization pipeline is not initialized. Check HF_TOKEN or model ID.")

        waveform, sr = torchaudio.load(wav_path)
        waveform, sr = _to_mono_16k(waveform, sr)
        result = self.pipeline({"waveform": waveform, "sample_rate": sr}, **kwargs)
        annotation = getattr(result, "annotation", result)

        turns: List[Tuple[int, int, str]] = []
        if hasattr(annotation, "itertracks"):
            for turn, _, speaker in annotation.itertracks(yield_label=True):
                s_ms = int(float(turn.start) * 1000.0)
                e_ms = int(float(turn.end) * 1000.0)
                turns.append((s_ms, e_ms, str(speaker)))
            return turns

        if hasattr(annotation, "itersegments"):
            for seg in annotation.itersegments():
                s_ms = int(float(seg.start) * 1000.0)
                e_ms = int(float(seg.end) * 1000.0)
                try:
                    label = str(annotation[seg])
                except Exception:
                    label = "SPEAKER_UNKNOWN"
                turns.append((s_ms, e_ms, label))
        return turns
