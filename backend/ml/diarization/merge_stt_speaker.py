def merge_stt_with_diarization(stt_segments, diarization_segments):
    """
    stt_segments: [{"start": 0.0, "end": 3.2, "text": "..."}]
    diarization_segments: [{"start": 0.0, "end": 4.0, "speaker": "SPEAKER_0"}]
    return: [{"speaker": "SPEAKER_0", "text": "..."}]
    """
    results = []
    for seg in stt_segments:
        seg_start, seg_end, text = seg["start"], seg["end"], seg["text"]

        # 겹치는 화자 찾기
        matched = [
            d for d in diarization_segments
            if not (seg_end <= d["start"] or seg_start >= d["end"])
        ]
        speaker = matched[0]["speaker"] if matched else "UNKNOWN"

        results.append({
            "speaker": speaker,
            "text": text
        })
    return results
