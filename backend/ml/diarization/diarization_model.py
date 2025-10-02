from pyannote.audio import Pipeline
import os

class DiarizationModel:
    def __init__(self, hf_token: str = None):
        hf_token = hf_token or os.getenv("HF_TOKEN")
        if not hf_token:
            raise ValueError("Hugging Face token이 필요합니다 (HF_TOKEN 환경변수).")

        print("🚀 Pyannote diarization pipeline 로딩 중...")
        self.pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization",
            use_auth_token=hf_token
        )
        print("✅ Pyannote 로딩 완료!")

    def run(self, audio_path: str):
        diarization = self.pipeline(audio_path)
        results = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            results.append({
                "start": float(turn.start),
                "end": float(turn.end),
                "speaker": speaker
            })
        return results