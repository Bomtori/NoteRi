# whisper/backend/ml/postprocess/timestamp_deduplicator.py
from typing import List, Tuple

_PUNCTS = ".,?!;:~…·“”\"'()[]{}<>-—_|／\\`"

def _norm_token(tok: str) -> str:
    t = tok.strip().lower()
    return "".join(ch for ch in t if ch not in _PUNCTS)

class TimestampDeduplicator:
    """
    단어-단위 접합 방식:
    - 이전에 출력한 단어들의 '꼬리'와, 새로 들어온 단어들의 '머리'가
      가장 길게 정확히 겹치는 구간(k)을 찾는다.
    - 그 겹친 k개를 제외한 나머지(새로운 부분)만 출력으로 추가한다.
    - 이렇게 하면 '앞뒤가 잘리는' 현상 없이 '중복'도 사라진다.
    """
    def __init__(self, tail_words: int = 3, time_backoff_sec: float = 0.7):
        self.tail_words = int(tail_words)
        self.time_backoff = float(time_backoff_sec)
        self.prev_tail_norm: List[str] = []   # 이전에 출력한 단어 꼬리(정규화)
        self.last_end_time: float = 0.0       # 마지막으로 출력된 단어의 end 시각(초)

    def reset(self):
        self.prev_tail_norm.clear()
        self.last_end_time = 0.0

    def _longest_overlap(self, prev: List[str], curr: List[str]) -> int:
        """
        prev의 suffix와 curr의 prefix가 가장 길게 일치하는 길이 k를 찾는다.
        정확 매칭(정규화 단어 기준).
        """
        max_k = min(len(prev), len(curr), self.tail_words)
        for k in range(max_k, 0, -1):
            if prev[-k:] == curr[:k]:
                return k
        return 0

    def filter(self, segments) -> str:
        """
        segments: faster-whisper segments (word timestamps 포함)
        return: 중복 제거 후 '새로 추가될' 텍스트 (str)
        """
        # 1) 새로 들어온 단어들 모으기
        curr_raw: List[str] = []
        curr_norm: List[str] = []
        curr_times: List[Tuple[float, float]] = []  # (start, end)

        for seg in segments:
            # seg.words: List[Word] (word.word, word.start, word.end)
            for w in getattr(seg, "words", []) or []:
                raw = (w.word or "").strip()
                if not raw:
                    continue
                curr_raw.append(raw)
                curr_norm.append(_norm_token(raw))
                curr_times.append((float(w.start or 0.0), float(w.end or 0.0)))

        if not curr_raw:
            return ""

        # 2) 이전 출력 꼬리(prev_tail_norm)와 새 단어(curr_norm)의 최장 접합 k
        k = self._longest_overlap(self.prev_tail_norm, curr_norm)

        # 3) k개(겹친 부분) 이후의 '진짜 새로운 부분'만 후보로 삼는다
        emit_raw = curr_raw[k:]
        emit_norm = curr_norm[k:]
        emit_times = curr_times[k:]

        # 4) 시간 역행 방지: 이전에 이미 출력 완료한 end_time보다
        #    명백히 과거(end <= last_end_time + backoff)인 단어는 방출하지 않음
        filtered_raw = []
        filtered_norm = []
        latest_end = self.last_end_time
        cutoff = self.last_end_time - self.time_backoff  # 약간의 여유 허용

        for tok, tok_norm, (st, ed) in zip(emit_raw, emit_norm, emit_times):
            # ed가 이전 출력보다 충분히 이후인 단어만 채택
            if ed > cutoff:
                filtered_raw.append(tok)
                filtered_norm.append(tok_norm)
                if ed > latest_end:
                    latest_end = ed

        # 5) 상태 갱신: prev_tail_norm = (prev_tail_norm + 새로 낸 단어들)의 꼬리
        if filtered_norm:
            joined_tail = (self.prev_tail_norm + filtered_norm)[-self.tail_words:]
            self.prev_tail_norm = joined_tail
            self.last_end_time = latest_end
        # (filtered가 비었으면 상태는 유지)

        return " ".join(t.strip() for t in filtered_raw if t.strip())
