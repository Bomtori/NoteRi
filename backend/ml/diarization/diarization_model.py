from __future__ import annotations
import os, torch
from typing import List, Tuple
from pyannote.audio import Pipeline

class DiarizationModel:
    _instance = None

    def __init__(self, hf_token: str | None = None):
            token = hf_token or os.getenv("HF_TOKEN")
            model_id = os.getenv("PYANNOTE_MODEL_ID", "pyannote/speaker-diarization-community-1")

            # token/use_auth_token 호환
            try:
                self.pipeline = Pipeline.from_pretrained(model_id, token=token)            # >=4.x
            except TypeError:
                self.pipeline = Pipeline.from_pretrained(model_id, use_auth_token=token)   # <=3.x

            if torch.cuda.is_available():
                try:
                    self.pipeline.to("cuda")
                except Exception:
                    self.pipeline.to(torch.device("cuda"))

    @classmethod
    def get(cls):
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
