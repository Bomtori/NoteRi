# backend/services/diarization.py
from __future__ import annotations
import os
import torchaudio
from typing import List, Tuple
from sqlalchemy.orm import Session
from backend.app.db import SessionLocal
from backend.app.model import RecordingSession, RecordingResult, AudioData
from backend.app.util.crypto_path import decrypt_path
from backend.ml.diarization.diarization_model import DiarizationModel
import re
import logging, pprint
from collections import Counter

logger = logging.getLogger(__name__)

def _to_mono_16k(waveform, sample_rate):
    # 채널 평균으로 mono
    if waveform.ndim == 2 and waveform.size(0) > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    # 필요시 16k 리샘플
    target_sr = 16000
    if sample_rate != target_sr:
        resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=target_sr)
        waveform = resampler(waveform)
        sample_rate = target_sr
    return waveform, sample_rate


def _best_label_for_segment(s_ms:int, e_ms:int, diar_turns):
    # diar_turns: list[(ts_ms, te_ms, model_key)]
    best_label, best_ov = "U", -1
    for ts,te,label in diar_turns:
        ov = max(0, min(e_ms, te) - max(s_ms, ts))
        if ov > best_ov:
            best_label, best_ov = label, ov
    if best_ov <= 0:
        # 겹침 없으면 "가장 가까운 턴"의 라벨
        closest = min(diar_turns, key=lambda t: min(abs(s_ms - t[0]), abs(e_ms - t[1])))
        return closest[2]
    return best_label


async def run_diarization_for_session(session_id: int):
    with SessionLocal() as db:
        sess: RecordingSession | None = db.query(RecordingSession).get(session_id)
        if not sess or sess.is_diarized:
            return
        audio: AudioData | None = sess.audio
        if not audio or not audio.file_path:
            return

        real_path = decrypt_path(audio.file_path)
        model = DiarizationModel.get()

        # 🔍 추론 실행
        turns = model.infer_file(real_path)  # [(start_ms, end_ms, "SPEAKER_00"), ...]
        if not turns:
            logger.info("🎧 Diarization returns no turns.")
            return

        # ✅ 콘솔 로그: 개수/미리보기/스피커 분포/총 커버리지
        total_ms = sum(max(0, e - s) for s, e, _ in turns)
        dist = Counter(lbl for *_ , lbl in turns)
        logger.info(f"🎧 Diarization turns: {len(turns)} items, coverage={total_ms/1000:.2f}s")
        logger.info("🎧 Speaker distribution: " + ", ".join(f"{k}={v}" for k, v in dist.items()))
        logger.info("🎧 Preview (first 10):\n" + pprint.pformat(turns[:10]))

        # 이후 DB 업데이트
        diar_turns = sorted(turns, key=lambda x: x[0])
        _update_results_with_labels(db, session_id, diar_turns)

        sess.is_diarized = True
        db.commit()


def _normalize_speaker_label(label: str) -> str:
    """pyannote 'SPEAKER_00' → 'speaker00' 형식 변환(숫자 2자리 패딩)"""
    if not label:
        return "speaker99"
    # 일반 케이스: "SPEAKER_00", "SPEAKER_0", "SPEAKER_12"
    m = re.search(r'(\d+)$', label)
    if m:
        return f"speaker{int(m.group(1)):02d}"
    return "speaker99"

def _update_results_with_labels(db: Session, session_id:int, diar_turns):
    rows = (
        db.query(RecordingResult)
          .filter(RecordingResult.recording_session_id == session_id)
          .order_by(RecordingResult.started_at.asc())
          .all()
    )
    summary = {}
    for r in rows:
        if not r.started_at or not r.ended_at:
            continue
        base = int(sess.started_at.timestamp()*1000) if sess.started_at else 0
        s = int(r.started_at.timestamp()*1000) - base
        e = int(r.ended_at.timestamp()*1000)   - base
        label = _normalize_speaker_label(_best_label_for_segment(s, e, diar_turns))
        r.speaker_label = label
        summary[label] = summary.get(label, 0) + 1

    db.commit()

    print("📊 Speaker distribution:", summary)
    for spk, count in summary.items():
        sample = next((r.raw_text for r in rows if r.speaker_label == spk and r.raw_text), "")
        print(f"🗣️ {spk}: {count} segments, e.g. {sample[:50]}")

