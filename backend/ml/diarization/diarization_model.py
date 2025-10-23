# backend/ml/diarization/diarization_model.py
from __future__ import annotations
import os
import torch
import torchaudio
from typing import List, Tuple
from pyannote.audio import Pipeline

def _to_mono_16k(waveform: torch.Tensor, sample_rate: int) -> tuple[torch.Tensor, int]:
    # [channels, time] → mono
    if waveform.ndim == 2 and waveform.size(0) > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    # resample to 16k if needed
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
        token = os.getenv("HF_TOKEN")
        if not token:
            raise RuntimeError("HF_TOKEN env var not set")

        model_id = os.getenv("PYANNOTE_MODEL_ID", "pyannote/speaker-diarization-community-1")
        # 필요 시 revision 고정하고 싶으면 아래처럼:
        # revision = os.getenv("PYANNOTE_REVISION")  # 예: "v4.0.1"
        # self.pipeline = Pipeline.from_pretrained(model_id, token=token, revision=revision)

        self.pipeline = Pipeline.from_pretrained(model_id, token=token)
        if torch.cuda.is_available():
            self.pipeline.to(torch.device("cuda"))

    def infer_file(self, wav_path: str, **kwargs) -> List[Tuple[int, int, str]]:
        """
        반환: [(start_ms, end_ms, "SPEAKER_00"), ...]
        """
        # 🔧 AudioDecoder 우회: torchaudio로 직접 로드
        waveform, sr = torchaudio.load(wav_path)      # [channels, time]
        waveform, sr = _to_mono_16k(waveform, sr)     # 16k mono 권장

        # pyannote 4.x: waveform 입력
        result = self.pipeline({"waveform": waveform, "sample_rate": sr}, **kwargs)
        annotation = getattr(result, "annotation", result)

        turns: List[Tuple[int, int, str]] = []
        if hasattr(annotation, "itertracks"):
            for turn, _, speaker in annotation.itertracks(yield_label=True):
                s_ms = int(float(turn.start) * 1000.0)
                e_ms = int(float(turn.end) * 1000.0)
                turns.append((s_ms, e_ms, str(speaker)))
            return turns

        # 폴백(아주 드문 경우)
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
