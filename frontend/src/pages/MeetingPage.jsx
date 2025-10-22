// frontend/src/pages/MeetingPage.jsx
import React, { useEffect, useRef, useState } from "react";

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

export default function MeetingPage() {
  const [liveText, setLiveText] = useState("");
  const [history, setHistory] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [merged, setMerged] = useState([]);
  const [sessionId, setSessionId] = useState(null);

  // idle | recording | paused
  const [recordingState, setRecordingState] = useState("idle");

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const sourceRef = useRef(null);

  // 일시중지 여부(onaudioprocess에서 빠르게 참조)
  const pausedRef = useRef(false);

  const historyEndRef = useRef(null);
  const summaryEndRef = useRef(null);

  const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/stt";
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  useEffect(() => {
    if (historyEndRef.current) historyEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [history]);
  useEffect(() => {
    if (summaryEndRef.current) summaryEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [summaries]);

  useEffect(() => {
    return () => {
      if (recordingState !== "idle") stopRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 최신 세션 ID 조회(녹음 종료 직후 한 번 호출)
  const fetchLatestSessionId = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions/latest`);
      if (!res.ok) throw new Error(`latest session fetch failed: ${res.status}`);
      const data = await res.json();
      if (data?.id) {
        setSessionId(data.id);
        return data.id;
      }
    } catch (e) {
      console.error("❌ fetchLatestSessionId:", e);
    }
    return null;
  };

  const startRecording = async () => {
    if (recordingState !== "idle") return;

    // 새 세션 UI 초기화
    setLiveText("");
    setHistory([]);
    setSummaries([]);
    setSpeakers([]);
    setMerged([]);

    setRecordingState("recording");
    pausedRef.current = false;

    // 1) WebSocket 연결
    wsRef.current = new WebSocket(WS_URL);
    wsRef.current.binaryType = "arraybuffer";
    wsRef.current.onopen = () => {
      console.log("✅ WS connected:", WS_URL);
    };
    wsRef.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.realtime) setLiveText(msg.realtime);
        if (msg.append) setHistory((prev) => [...prev, msg.append]);
        if (msg.paragraph || msg.summary) {
          setSummaries((prev) => [
            ...prev,
            { paragraph: msg.paragraph || "", summary: msg.summary || "", ts: Date.now() },
          ]);
        }
      } catch (err) {
        console.error("❌ JSON parse error:", err);
      }
    };
    wsRef.current.onerror = (e) => console.error("❌ WS error:", e);
    wsRef.current.onclose = (e) => console.log("🔌 WS closed:", e.code, e.reason);

    // 2) 오디오 캡처 & PCM 전송
    streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    sourceRef.current = source;

    processorRef.current = audioContextRef.current.createScriptProcessor(16384, 1, 1);
    processorRef.current.onaudioprocess = (e) => {
      // 일시중지 중이면 전송 안 함
      if (pausedRef.current) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const input = e.inputBuffer.getChannelData(0);
      const pcm = floatTo16BitPCM(input);
      wsRef.current.send(pcm);
    };

    source.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);
  };

  const pauseRecording = async () => {
    if (recordingState !== "recording") return;
    pausedRef.current = true;
    setRecordingState("paused");

    // 그래프 자체를 멈춰 전송 0 (onaudioprocess도 중단됨)
    if (audioContextRef.current && audioContextRef.current.state === "running") {
      try {
        await audioContextRef.current.suspend();
        console.log("⏸️ audio context suspended");
      } catch (e) {
        console.warn("suspend failed:", e);
      }
    }
    // ✅ WS는 열어둡니다(같은 파일/세션 유지)
  };

  const resumeRecording = async () => {
    if (recordingState !== "paused") return;
    pausedRef.current = false;

    // 그래프 재개
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      try {
        await audioContextRef.current.resume();
        console.log("▶️ audio context resumed");
      } catch (e) {
        console.warn("resume failed:", e);
      }
    }
    setRecordingState("recording");
  };

  const stopRecording = async () => {
    if (recordingState === "idle") return;
    setRecordingState("idle");
    pausedRef.current = false;

    try {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
        processorRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } catch (e) {
      console.warn("⚠️ cleanup warning:", e);
    }

    // ⛔ stop에서만 WS 닫기 → 백엔드가 save_raw_audio() 수행
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, "Normal Closure");
    }
    wsRef.current = null;
    
    // 🔹 백엔드가 Redis→Postgres 적재를 마친 뒤 최신 세션ID 확보
    // (WS close 후 파일 저장/ingest가 수행되므로 약간의 지연이 있을 수 있음)
    // 간단 폴링: 최대 10초, 500ms 간격
    let tries = 0;
    while (tries++ < 20) {
      const sid = await fetchLatestSessionId();
      if (sid) break;
      await sleep(500);
    }
  };

  const runDiarization = async () => {
    // 세션 기반 다이어라이즈: /sessions/{id}/diarize → /sessions/{id} 폴링 → /sessions/{id}/results 조회
    if (!sessionId) {
      alert("세션을 찾을 수 없습니다. 녹음을 종료한 뒤 다시 시도하세요.");
      return;
    }
    try {
      // 1) 다이어라이즈 시작
      const start = await fetch(`${API_BASE}/sessions/${sessionId}/diarize`, { method: "POST" });
      if (!start.ok) throw new Error(`diarize start failed: ${start.status}`);

      // 2) is_diarized가 true 될 때까지 폴링 (최대 60초)
      let tries = 0;
      while (tries++ < 60) {
        const s = await fetch(`${API_BASE}/sessions/${sessionId}`);
        const sj = await s.json();
        if (sj?.is_diarized) break;
        await sleep(1000);
      }

      // 3) 결과 조회 → speakers로 렌더
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/results`);
      if (!res.ok) throw new Error(`results fetch failed: ${res.status}`);
      const rows = await res.json(); // [{raw_text, speaker_label, started_at, ended_at}, ...]
      const formatted = rows.map((r) => ({
        speaker: r.speaker_label || "U",
        text: r.raw_text || "",
        start: typeof r.offset_start_sec === "number" ? r.offset_start_sec : undefined,
        end:   typeof r.offset_end_sec   === "number" ? r.offset_end_sec   : undefined,
      }));
      setSpeakers(formatted);
      // 병합 뷰가 필요 없다면 setMerged([])로 초기화
      setMerged([]);
    } catch (e) {
      console.error("❌ Diarization error:", e);
      setSpeakers([]);
      setMerged([]);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">📝 실시간 회의 녹음 STT</h1>

      {/* 컨트롤 */}
      <div className="flex gap-3 items-center">
        <button
          onClick={startRecording}
          disabled={recordingState !== "idle"}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-40"
        >
          ▶️ 시작
        </button>

        {recordingState === "recording" && (
          <button
            onClick={pauseRecording}
            className="px-4 py-2 rounded bg-yellow-500 text-white"
          >
            ⏸️ 일시중지
          </button>
        )}

        {recordingState === "paused" && (
          <button
            onClick={resumeRecording}
            className="px-4 py-2 rounded bg-green-600 text-white"
          >
            ▶️ 재개
          </button>
        )}

        <button
          onClick={stopRecording}
          disabled={recordingState === "idle"}
          className="px-4 py-2 rounded bg-gray-200 disabled:opacity-40"
        >
          ⏹️ 종료
        </button>

        <button
          onClick={runDiarization}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          🗣️ 화자 분리 실행
        </button>
      </div>

      {/* 실시간 */}
      <div className="p-4 border bg-white rounded shadow min-h-[72px]">
        <h2 className="font-semibold mb-2">🎤 실시간</h2>
        <p className="whitespace-pre-wrap text-gray-900">
          {recordingState === "paused" ? "⏸️ 일시중지 중…" : (liveText || "...")}
        </p>
      </div>

      {/* 확정 히스토리 */}
      <div className="p-4 border bg-white rounded shadow max-h-64 overflow-y-auto">
        <h2 className="font-semibold mb-2">📜 확정 히스토리</h2>
        {history.length ? (
          <ul className="list-disc pl-5 space-y-1">
            {history.map((line, idx) => (
              <li key={idx} className="text-gray-800">{line}</li>
            ))}
            <div ref={historyEndRef} />
          </ul>
        ) : (
          <p className="text-gray-500">아직 확정된 문장이 없습니다.</p>
        )}
      </div>

      {/* 1분 요약 */}
      <div className="p-4 border bg-white rounded shadow max-h-64 overflow-y-auto">
        <h2 className="font-semibold mb-2">⏱️ 1분 요약</h2>
        {summaries.length ? (
          <div className="space-y-3">
            {summaries.map((s, i) => (
              <div key={i} className="bg-gray-50 p-3 rounded">
                {s.paragraph ? <p className="text-xs text-gray-500 mb-1">원문: {s.paragraph}</p> : null}
                <p className="text-gray-900">✅ {s.summary}</p>
              </div>
            ))}
            <div ref={summaryEndRef} />
          </div>
        ) : (
          <p className="text-gray-500">요약 대기 중…</p>
        )}
      </div>

      {/* 화자 분리 */}
      <div className="p-4 border bg-white rounded shadow max-h-60 overflow-y-auto">
        <h2 className="font-semibold mb-2">🗣️ 화자 분리 결과</h2>
        {speakers.length ? (
          <div className="space-y-1">
            {speakers.map((s, i) => (
              <p key={i} className="text-gray-800">
                <b>{s.speaker}</b>: {s.text || ""}
                {typeof s.start === "number" && typeof s.end === "number" ? (
                  <span className="text-xs text-gray-500">  [{s.start.toFixed(2)}–{s.end.toFixed(2)}s]</span>
                ) : null}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">결과 없음 (녹음 종료 후 실행)</p>
        )}
      </div>

      {/* 병합 결과 */}
      <div className="p-4 border bg-white rounded shadow max-h-60 overflow-y-auto">
        <h2 className="font-semibold mb-2">🧩 화자+문장 병합</h2>
        {merged.length ? (
          <div className="space-y-1">
            {merged.map((m, i) => (
              <p key={i} className="text-gray-800">
                <b>{m.speaker || "UNKNOWN"}</b>: {m.text}
                {typeof m.start === "number" && typeof m.end === "number" ? (
                  <span className="text-xs text-gray-500">  [{m.start.toFixed(2)}–{m.end.toFixed(2)}s]</span>
                ) : null}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">병합 결과 없음</p>
        )}
      </div>
    </div>
  );
}
