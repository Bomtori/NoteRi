# backend/services/diarization.py
from pyannote.audio import Pipeline
import torchaudio
import os, torch

class DiarizationService:
    def __init__(self):
        token = os.getenv("HF_TOKEN")
        if not token:
            raise RuntimeError("HF_TOKEN env var not set")

        # 4.x에서 정상 접근 가능한 공개 파이프라인
        self.pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-community-1",
            token=token
        )
        if torch.cuda.is_available():
            self.pipeline.to(torch.device("cuda"))

    def diarize(self, filepath, num_speakers=None, min_speakers=None, max_speakers=None):
        # torchcodec 우회: 파일을 메모리로 읽어서 전달
        waveform, sample_rate = torchaudio.load(filepath)

        result = self.pipeline(
            {"waveform": waveform, "sample_rate": sample_rate},
            num_speakers=num_speakers,
            min_speakers=min_speakers,
            max_speakers=max_speakers
        )

        # 4.x: DiarizeOutput 안에 annotation이 들어있음
        annotation = getattr(result, "annotation", result)

        items = []
        # 2.x/3.x 방식 (여전히 Annotation에 있음)
        if hasattr(annotation, "itertracks"):
            for turn, _, speaker in annotation.itertracks(yield_label=True):
                items.append({
                    "speaker": speaker,
                    "start": round(float(turn.start), 2),
                    "end": round(float(turn.end), 2),
                })
            return items

        # 폴백: itersegments + __getitem__ 조합
        # (겹치는 트랙 있을 때도 speaker 라벨 가져올 수 있음)
        if hasattr(annotation, "itersegments"):
            for seg in annotation.itersegments():
                try:
                    label = annotation[seg]  # 겹침 없을 때
                    items.append({
                        "speaker": str(label),
                        "start": round(float(seg.start), 2),
                        "end": round(float(seg.end), 2),
                    })
                except Exception:
                    # 겹치는 트랙이 있을 경우 (segment, track) 키로 조회
                    if hasattr(annotation, "get_timeline"):
                        # 가능한 트랙을 추정할 수 없으면 구간만 리턴 (라벨 Unknown)
                        items.append({
                            "speaker": "Unknown",
                            "start": round(float(seg.start), 2),
                            "end": round(float(seg.end), 2),
                        })
            return items

        # 정말 예외적인 경우: 구조를 모를 때는 문자열로라도 덤프
        return [{"speaker": "Unknown", "start": 0.0, "end": 0.0}]
