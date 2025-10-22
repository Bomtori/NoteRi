# backend/services/diarization.py
from __future__ import annotations
import os
import torchaudio
from typing import List, Tuple
from sqlalchemy.orm import Session
from backend.app.db import SessionLocal
from backend.app.model import RecordingSession, RecordingResult, AudioData
from backend.ml.diarization.diarization_model import DiarizationModel
# 네 프로젝트의 복호화 유틸 경로에 맞게 import
from backend.app.util.crypto_path import decrypt_path

ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

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

def _map_keys_to_ABC(turns: List[Tuple[int,int,str]]):
    # turns: (start_ms, end_ms, "SPEAKER_00")
    order, next_idx = {}, 0
    labeled = []
    for s,e,k in sorted(turns, key=lambda x:x[0]):
        if k not in order:
            order[k] = ABC[next_idx]
            next_idx += 1
        labeled.append((s,e,order[k],k))
    return labeled  # (s,e,"A","SPEAKER_00")

def _best_label_for_segment(s_ms:int, e_ms:int, diar_labeled):
    best_label, best_ov = "U", -1
    for ts,te,label,_ in diar_labeled:
        ov = max(0, min(e_ms, te) - max(s_ms, ts))
        if ov > best_ov:
            best_label, best_ov = label, ov
    if best_ov <= 0:
        # 겹침 없으면 가장 가까운 턴 라벨
        closest = min(diar_labeled, key=lambda t: min(abs(s_ms - t[0]), abs(e_ms - t[1])))
        return closest[2]
    return best_label

def _update_results_with_labels(db: Session, session_id:int, diar_labeled):
    rows: list[RecordingResult] = (
        db.query(RecordingResult)
          .filter(RecordingResult.recording_session_id == session_id)
          .order_by(RecordingResult.started_at.asc())
          .all()
    )
    for r in rows:
        if not r.started_at or not r.ended_at:
            continue
        s = int(r.started_at.timestamp()*1000)
        e = int(r.ended_at.timestamp()*1000)
        r.speaker_label = _best_label_for_segment(s, e, diar_labeled)
    db.commit()

async def run_diarization_for_session(session_id: int):
    with SessionLocal() as db:
        sess: RecordingSession | None = db.query(RecordingSession).get(session_id)
        if not sess or sess.is_diarized:
            return
        audio: AudioData | None = sess.audio
        if not audio or not audio.file_path:
            return

        real_path = decrypt_path(audio.file_path)  # 암호화 경로 복호화 → 실제 파일경로
        # 파일이 이미 WAV/16k/mono면 infer_file로 바로:
        model = DiarizationModel.get()
        turns = model.infer_file(real_path)  # (ms,ms,key)

        # 필요 시 메모리 로딩(코덱 이슈 회피) 버전:
        # waveform, sr = torchaudio.load(real_path)
        # waveform, sr = _to_mono_16k(waveform, sr)
        # turns = model.infer_mem(waveform, sr)  # infer_mem 구현 시

        if not turns:
            return
        diar_labeled = _map_keys_to_ABC(turns)

        _update_results_with_labels(db, session_id, diar_labeled)

        sess.is_diarized = True
        db.commit()

