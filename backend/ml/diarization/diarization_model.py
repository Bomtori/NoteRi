from __future__ import annotations
import os, torch
from typing import List, Tuple

class DiarizationModel:
    _instance: "DiarizationModel|None" = None

    def __init__(self, hf_token: str | None = None, device: str | None = None):
        from pyannote.audio import Pipeline
        token = hf_token or os.getenv("HF_TOKEN")
        if not token:
            raise RuntimeError("HF_TOKEN env var not set")

        # 파이프라인 ID: 공개 커뮤니티/공식 중 하나 선택
        model_id = os.getenv("PYANNOTE_MODEL_ID", "pyannote/speaker-diarization")
        # token vs use_auth_token 호환
        try:
            self.pipeline = Pipeline.from_pretrained(model_id, token=token)  # >=4.x
        except TypeError:
            self.pipeline = Pipeline.from_pretrained(model_id, use_auth_token=token)  # <=3.x

        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        # to() 호환
        try:
            self.pipeline.to(device)
        except Exception:
            import torch as _t
            self.pipeline.to(_t.device(device))

    @classmethod
    def get(cls) -> "DiarizationModel":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def infer_file(self, wav_path: str) -> List[Tuple[int,int,str]]:
        """(start_ms, end_ms, speaker_key) 리스트 반환"""
        diar = self.pipeline(wav_path)
        out = []
        # annotation 객체 호환 처리
        ann = getattr(diar, "annotation", diar)
        if hasattr(ann, "itertracks"):
            for turn, _, spk in ann.itertracks(yield_label=True):
                out.append((int(turn.start*1000), int(turn.end*1000), str(spk)))
            return out
        if hasattr(ann, "itersegments"):
            for seg in ann.itersegments():
                try:
                    label = str(ann[seg])
                except Exception:
                    label = "Unknown"
                out.append((int(seg.start*1000), int(seg.end*1000), label))
        return out
