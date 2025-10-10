import React, { useEffect, useRef, useState } from "react";

// 32-bit float PCM -> 16-bit PCM (Little Endian) 변환
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
    const [speakers, setSpeakers] = useState([]);    // diarization 결과(구간)
    const [merged, setMerged] = useState([]);        // 병합 결과(화자+문장)

    const [recordingState, setRecordingState] = useState("idle"); // idle | recording
    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const streamRef = useRef(null);
    const sourceRef = useRef(null);

    const historyEndRef = useRef(null);
    const summaryEndRef = useRef(null);

    const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/stt";
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

    useEffect(() => {
        // 히스토리/요약 자동 스크롤
        if (historyEndRef.current) historyEndRef.current.scrollIntoView({ behavior: "smooth" });
    }, [history]);
    useEffect(() => {
        if (summaryEndRef.current) summaryEndRef.current.scrollIntoView({ behavior: "smooth" });
    }, [summaries]);

    useEffect(() => {
        // 컴포넌트 언마운트 시 정리
        return () => {
            if (recordingState !== "idle") stopRecording();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startRecording = async () => {
        if (recordingState !== "idle") return;

        // 새 세션 시작 시 UI 초기화
        setLiveText("");
        setHistory([]);
        setSummaries([]);
        setSpeakers([]);
        setMerged([]);

        setRecordingState("recording");

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
                        {
                            paragraph: msg.paragraph || "",
                            summary: msg.summary || "",
                            ts: Date.now(),
                        },
                    ]);
                }
            } catch (err) {
                console.error("❌ JSON parse error:", err);
            }
        };
        wsRef.current.onerror = (e) => console.error("❌ WS error:", e);
        wsRef.current.onclose = (e) => console.log("🔌 WS closed:", e.code, e.reason);

        // 2) 오디오 캡처 & ScriptProcessor로 PCM 전송(16kHz 권장)
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

        const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
        sourceRef.current = source;

        // 버퍼 사이즈 16384: 레이턴시/부하 절충. 필요 시 8192/4096로 조절.
        processorRef.current = audioContextRef.current.createScriptProcessor(16384, 1, 1);
        processorRef.current.onaudioprocess = (e) => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            const input = e.inputBuffer.getChannelData(0);
            const pcm = floatTo16BitPCM(input);
            wsRef.current.send(pcm);
        };

        source.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);
    };

    const stopRecording = () => {
        if (recordingState === "idle") return;
        setRecordingState("idle");

        try {
            if (processorRef.current) {
                processorRef.current.disconnect();
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

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close(1000, "Normal Closure");
        }
        wsRef.current = null;
    };

    const runDiarization = async () => {
        try {
            const params = new URLSearchParams({ num_speakers: "2" });
            const res = await fetch(`${API_BASE}/diarize/latest?${params.toString()}`, { method: "GET" });
            if (!res.ok) throw new Error(`Failed to diarize: ${res.status}`);
            const data = await res.json();

            // [{start, end, speaker, ...}] -> 간단 표시용 변환(필요시 그대로 사용)
            const formatted = (data || []).map((d) => ({
                start: d.start,
                end: d.end,
                speaker: d.speaker,
                text: d.text || "",
            }));
            setSpeakers(formatted);

            // 병합 결과(있을 때만)
            const res2 = await fetch(`${API_BASE}/diarize/merge-latest`, { method: "GET" });
            if (res2.ok) {
                const mergedData = await res2.json();
                setMerged(Array.isArray(mergedData) ? mergedData : []);
            } else {
                setMerged([]);
            }
        } catch (err) {
            console.error("❌ Diarization error:", err);
            setSpeakers([]);
            setMerged([]);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">📝 실시간 회의 녹음 STT</h1>

            {/* 컨트롤 */}
            <div className="flex gap-3">
                <button
                    onClick={startRecording}
                    disabled={recordingState === "recording"}
                    className="px-4 py-2 rounded bg-black text-white disabled:opacity-40"
                >
                    ▶️ 시작
                </button>
                <button
                    onClick={stopRecording}
                    disabled={recordingState === "idle"}
                    className="px-4 py-2 rounded bg-gray-200 disabled:opacity-40"
                >
                    ⏹️ 종료
                </button>
                <button onClick={runDiarization} className="px-4 py-2 rounded bg-blue-600 text-white">
                    🗣️ 화자 분리 실행
                </button>
            </div>

            {/* 라이브 */}
            <div className="p-4 border bg-white rounded shadow min-h-[72px]">
                <h2 className="font-semibold mb-2">🎤 실시간</h2>
                <p className="whitespace-pre-wrap text-gray-900">{liveText || "..."}</p>
            </div>

            {/* 확정 히스토리 */}
            <div className="p-4 border bg-white rounded shadow max-h-64 overflow-y-auto">
                <h2 className="font-semibold mb-2">📜 확정 히스토리</h2>
                {history.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                        {history.map((line, idx) => (
                            <li key={idx} className="text-gray-800">
                                {line}
                            </li>
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
                                {s.paragraph ? (
                                    <p className="text-xs text-gray-500 mb-1">원문: {s.paragraph}</p>
                                ) : null}
                                <p className="text-gray-900">✅ {s.summary}</p>
                            </div>
                        ))}
                        <div ref={summaryEndRef} />
                    </div>
                ) : (
                    <p className="text-gray-500">요약 대기 중…</p>
                )}
            </div>

            {/* 화자 분리 결과 */}
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
