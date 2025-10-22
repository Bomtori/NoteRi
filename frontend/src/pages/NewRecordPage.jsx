import React, { useEffect, useRef, useState } from "react";
import RightPanel from "../components/recording/RightPanel";

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

export default function NewRecordPage() {
    // ===== 상태 =====
    const [activeTab, setActiveTab] = useState("record"); // record | script | speaker
    const [memoText, setMemoText] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [saveStatus, setSaveStatus] = useState("");

    const [liveText, setLiveText] = useState("");
    const [history, setHistory] = useState([]);
    const [summaries, setSummaries] = useState([]);
    const [refinedScript, setRefinedScript] = useState([]);
    const [speakers, setSpeakers] = useState([]);
    const [merged, setMerged] = useState([]);

    const [recordingState, setRecordingState] = useState("idle"); // idle | recording | paused
    const pausedRef = useRef(false);

    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const streamRef = useRef(null);
    const sourceRef = useRef(null);

    const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/stt";
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

    // ===== STT WebSocket =====
    const startRecording = async () => {
        if (recordingState !== "idle") return;
        setRecordingState("recording");
        pausedRef.current = false;
        setLiveText("");
        setHistory([]);
        setSummaries([]);
        setSpeakers([]);
        setMerged([]);
        setRefinedScript([]);

        wsRef.current = new WebSocket(WS_URL);
        wsRef.current.binaryType = "arraybuffer";

        wsRef.current.onopen = () => console.log("✅ WS connected:", WS_URL);

        wsRef.current.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.realtime) setLiveText(msg.realtime);
                if (msg.append) setHistory((prev) => [...prev, msg.append]);
                if (msg.summary) {
                    setSummaries((prev) => [
                        ...prev,
                        { summary: msg.summary, ts: Date.now() },
                    ]);
                }
            } catch (e) {
                console.error("JSON parse error:", e);
            }
        };

        wsRef.current.onerror = (e) => console.error("❌ WS error:", e);
        wsRef.current.onclose = (e) => console.log("🔌 WS closed:", e.code, e.reason);

        // 오디오 캡처
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
        sourceRef.current = source;
        processorRef.current = audioContextRef.current.createScriptProcessor(16384, 1, 1);
        processorRef.current.onaudioprocess = (e) => {
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
        if (audioContextRef.current?.state === "running") await audioContextRef.current.suspend();
    };

    const resumeRecording = async () => {
        if (recordingState !== "paused") return;
        pausedRef.current = false;
        if (audioContextRef.current?.state === "suspended") await audioContextRef.current.resume();
        setRecordingState("recording");
    };

    const stopRecording = () => {
        if (recordingState === "idle") return;
        setRecordingState("idle");
        pausedRef.current = false;
        try {
            processorRef.current?.disconnect();
            sourceRef.current?.disconnect();
            audioContextRef.current?.close();
            streamRef.current?.getTracks().forEach((t) => t.stop());
        } catch (e) {
            console.warn("⚠️ cleanup warning:", e);
        }
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close(1000, "Normal Closure");
        }
    };

    // ===== 모델 호출 =====
    const runRefineScript = async () => {
        try {
            const res = await fetch(`${API_BASE}/refine/latest`);
            if (!res.ok) throw new Error("Refine failed");
            const data = await res.json();
            setRefinedScript(data);
        } catch (e) {
            console.error("Refine error:", e);
        }
    };

    const runDiarization = async () => {
        try {
            const res = await fetch(`${API_BASE}/diarize/latest?num_speakers=2`);
            const data = await res.json();
            setSpeakers(data.diarization || []);
            const mergeRes = await fetch(`${API_BASE}/diarize/merge-latest`);
            const mergeData = await mergeRes.json();
            setMerged(mergeData || []);
        } catch (e) {
            console.error("Diarization error:", e);
        }
    };

    // ===== UI 렌더 =====
    return (
        <div className="flex gap-6 p-6 bg-gray-50 min-h-screen">
            {/* 왼쪽: 녹음/탭 영역 */}
            <main className="flex-1 bg-white rounded-2xl p-6 shadow-sm flex flex-col">
                {/* 상단 컨트롤 */}
                <div className="flex gap-3 mb-4">
                    <button onClick={startRecording} disabled={recordingState !== "idle"} className="btn-primary">
                        ▶️ 시작
                    </button>
                    {recordingState === "recording" && (
                        <button onClick={pauseRecording} className="btn-yellow">⏸️ 일시정지</button>
                    )}
                    {recordingState === "paused" && (
                        <button onClick={resumeRecording} className="btn-green">▶️ 재개</button>
                    )}
                    <button onClick={stopRecording} disabled={recordingState === "idle"} className="btn-gray">⏹ 종료</button>
                    <button onClick={runDiarization} className="btn-blue">🗣 화자분리</button>
                </div>

                {/* 탭 */}
                <div className="flex gap-4 border-b pb-2 mb-4">
                    {["record", "script", "speaker"].map((t) => (
                        <button
                            key={t}
                            onClick={() => setActiveTab(t)}
                            className={`pb-1 text-sm font-medium ${
                                activeTab === t ? "border-b-2 border-[#7E37F9] text-[#7E37F9]" : "text-gray-500"
                            }`}
                        >
                            {t === "record" ? "회의기록" : t === "script" ? "스크립트" : "화자분리 결과"}
                        </button>
                    ))}
                </div>

                {/* 탭 내용 */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === "record" && (
                        <section className="space-y-4">
                            <div className="p-4 border rounded bg-gray-50">
                                <h3 className="font-semibold mb-1">🎤 실시간</h3>
                                <p>{liveText || "..."}</p>
                            </div>
                            <div className="p-4 border rounded bg-gray-50">
                                <h3 className="font-semibold mb-1">⏱️ 1분 요약</h3>
                                {summaries.length ? summaries.map((s, i) => (
                                    <p key={i} className="text-sm text-gray-700">✅ {s.summary}</p>
                                )) : <p className="text-gray-400">요약 대기 중...</p>}
                            </div>
                        </section>
                    )}

                    {activeTab === "script" && (
                        <section className="space-y-2">
                            <button onClick={runRefineScript} className="btn-blue mb-2">✏️ 스크립트 갱신</button>
                            {refinedScript.length ? refinedScript.map((l, i) => (
                                <p key={i}><b>{l.speaker}</b>: {l.text}</p>
                            )) : <p className="text-gray-400">출력 없음</p>}
                        </section>
                    )}

                    {activeTab === "speaker" && (
                        <section className="space-y-2">
                            {merged.length ? merged.map((m, i) => (
                                <p key={i}><b>{m.speaker}</b>: {m.text}</p>
                            )) : <p className="text-gray-400">화자분리 결과 없음</p>}
                        </section>
                    )}
                </div>
            </main>

            {/* 오른쪽: 메모/GPT */}
            <RightPanel
                tabs={["memo", "gpt"]}
                memoText={memoText}
                setMemoText={setMemoText}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                saveStatus={saveStatus}
            />
        </div>
    );
}
