import React, { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import RightPanel from "../components/recording/RightPanel";
import apiClient from "../api/apiClient";


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
function formatDefaultTitle() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = now.getHours();
    const minute = String(now.getMinutes()).padStart(2, "0");
    const ampm = hour >= 12 ? "오후" : "오전";
    const displayHour = hour % 12 || 12;
    return `${month}.${day} ${ampm} ${displayHour}:${minute} 새 회의`;
}

export default function NewRecordPage() {
    const { id } = useParams(); // id가 있으면 조회 모드
    const isReplayMode = Boolean(id);

    const [activeTab, setActiveTab] = useState("record");
    const [recordingState, setRecordingState] = useState(isReplayMode ? "replay" : "idle");

    const [boardId, setBoardId] = useState(null);
    const [title, setTitle] = useState(()=>formatDefaultTitle()); // ()=> 추가 지연함수형으로 수정
    const [liveText, setLiveText] = useState("");
    const [summaries, setSummaries] = useState([]);
    const [refinedScript, setRefinedScript] = useState([]);

    const [memoText, setMemoText] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [saveStatus, setSaveStatus] = useState("");

    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const streamRef = useRef(null);
    const sourceRef = useRef(null);

    const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/stt";
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";


    // 🔹 조회 모드: 저장된 데이터 불러오기
    useEffect(() => {
        if (!isReplayMode) return;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/records/${id}`);
                const data = await res.json();
                setTitle(data.title || "제목 없음");
                setSummaries(data.summaries || []);
                setRefinedScript(data.transcripts || []);
                setRecordingState("replay");
            } catch (err) {
                console.error("기록 불러오기 실패:", err);
                setRecordingState("replay");
            }
        })();
    }, [id, isReplayMode]);

    // 🔹 녹음 시작
    // const startRecording = async () => {
    //     if (recordingState !== "idle") return;
    //     setRecordingState("recording");
    //     setLiveText("");
    //     setSummaries([]);
    //     setRefinedScript([]);
    //
    //     wsRef.current = new WebSocket(WS_URL);
    //     wsRef.current.binaryType = "arraybuffer";
    //
    //     wsRef.current.onopen = () => console.log("✅ WS connected:", WS_URL);
    //     wsRef.current.onmessage = (event) => {
    //         try {
    //             const msg = JSON.parse(event.data);
    //             if (msg.realtime) setLiveText(msg.realtime);
    //             if (msg.append)
    //                 setRefinedScript((prev) => [...prev, { text: msg.append }]);
    //             if (msg.summary) {
    //                 setSummaries((prev) => [...prev, { summary: msg.summary }]);
    //                 setLiveText(""); // 요약이 오면 실시간 문장 폐기
    //             }
    //         } catch (e) {
    //             console.error("JSON parse error:", e);
    //         }
    //     };
    //
    //     streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    //     audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
    //         sampleRate: 16000,
    //     });
    //     const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    //     sourceRef.current = source;
    //     processorRef.current = audioContextRef.current.createScriptProcessor(16384, 1, 1);
    //     processorRef.current.onaudioprocess = (e) => {
    //         if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    //         const input = e.inputBuffer.getChannelData(0);
    //         const pcm = floatTo16BitPCM(input);
    //         wsRef.current.send(pcm);
    //     };
    //     source.connect(processorRef.current);
    //     processorRef.current.connect(audioContextRef.current.destination);
    // };

    const startRecording = async () => {
        console.log("보낼 데이터:", { title, description: "녹음 중...", invite_role: "editor" });

        if (recordingState !== "idle") return;
        setRecordingState("recording");

        try {
            const payload = {
                // 최소필드만 먼저 보냄
                title: title || formatDefaultTitle(),
                // description, invite_role 등은 잠시 빼고 원인 찾자
            };
            console.log("보낼 데이터:", payload);

            const res = await apiClient.post("/boards", payload, {
                headers: { "Content-Type": "application/json" },
            });
            setBoardId(res.data.id);
        } catch (err) {
            console.error("❌ 회의 생성 실패:", err);
            // ⬇️ FastAPI 422 원인
            console.log("422 detail:", err?.response?.data);
            alert(`회의 생성 실패: ${JSON.stringify(err?.response?.data)}`);
        }

    };

    // 🔹 녹음 종료
    // const stopRecording = () => {
    //     if (recordingState === "idle") return;
    //     setRecordingState("stopped");
    //     try {
    //         processorRef.current?.disconnect();
    //         sourceRef.current?.disconnect();
    //         audioContextRef.current?.close();
    //         streamRef.current?.getTracks().forEach((t) => t.stop());
    //     } catch (e) {
    //         console.warn("⚠️ cleanup warning:", e);
    //     }
    //     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
    //         wsRef.current.close(1000, "Normal Closure");
    //     }
    // };
    const stopRecording = async () => {
        if (recordingState === "idle") return;
        setRecordingState("stopped");

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

        // 🔹 녹음 시간 계산 후 사용량 차감 API 호출
        try {
            const durationMinutes = 60; // 임시 값: 실제로는 녹음 시간 측정해서 반영
            await apiClient.post("/recordings/usage/use", {
                duration_minutes: durationMinutes,
                board_id: boardId,
            });
            console.log("✅ 사용량 차감 완료");
        } catch (err) {
            console.error("사용량 차감 실패:", err);
        }
    };

    // 🔹 제목 변경 저장
    const handleTitleSave = async () => {
        if (!isReplayMode) return; // 녹음 중일 때는 서버 저장 X
        try {
            await fetch(`${API_BASE}/records/${id}/title`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title }),
            });
        } catch (err) {
            console.error("제목 업데이트 실패:", err);
        }
    };

    // 🔹 스크립트 후처리
    const runRefineScript = async () => {
        try {
            const res = await fetch(`${API_BASE}/refine/latest`);
            const data = await res.json();
            setRefinedScript(data);
        } catch (e) {
            console.error("Refine error:", e);
        }
    };

    return (
        <div className="flex gap-6 p-6 bg-gray-50 min-h-screen">
            {/* 🔹 왼쪽 메인 */}
            <main className="flex-1 bg-white rounded-2xl p-6 shadow-sm flex flex-col h-[800px]">
                {/* 제목 입력 (녹음/조회 공통) */}
                <div className="mb-4">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleTitleSave}
                        className="text-xl font-semibold w-full border-none focus:ring-0 outline-none"
                        placeholder="회의 제목을 입력하세요"
                    />
                </div>

                {/* 상단 버튼 */}
                {recordingState === "replay" ? (
                    <div className="flex gap-3 mb-4">
                        <button className="btn-blue">📤 회의공유</button>
                        <button className="btn-purple">🎙 화자분리 템플릿 추가</button>
                    </div>
                ) : (
                    <div className="flex gap-3 mb-4">
                        <button
                            onClick={startRecording}
                            disabled={recordingState !== "idle"}
                            className="btn-primary"
                        >
                            ▶️ 시작
                        </button>
                        <button
                            onClick={stopRecording}
                            disabled={recordingState === "idle"}
                            className="btn-gray"
                        >
                            ⏹ 종료
                        </button>
                    </div>
                )}

                {/* 탭 버튼 */}
                <div className="flex gap-4 border-b pb-2 mb-4">
                    {["record", "script"].map((t) => (
                        <button
                            key={t}
                            onClick={() => setActiveTab(t)}
                            className={`pb-1 text-sm font-medium ${
                                activeTab === t
                                    ? "border-b-2 border-[#7E37F9] text-[#7E37F9]"
                                    : "text-gray-500"
                            }`}
                        >
                            {t === "record" ? "회의기록" : "스크립트"}
                        </button>
                    ))}
                </div>

                {/* 탭 내용 */}
                <div className="flex-1 overflow-y-auto space-y-4">
                    {/* 🟣 회의기록 탭 */}
                    {activeTab === "record" && (
                        <section className="space-y-4">
                            {summaries.length === 0 ? (
                                <div className="p-4 border rounded bg-gray-50">
                                    <h3 className="font-semibold mb-1">🎤 실시간</h3>
                                    <p>{liveText || "..."}</p>
                                </div>
                            ) : (
                                <>
                                    {summaries.map((s, i) => (
                                        <div key={i} className="p-4 border rounded bg-gray-50">
                                            <h3 className="font-semibold mb-1">⏱️ 1분 요약</h3>
                                            <p className="text-sm text-gray-700">✅ {s.summary}</p>
                                        </div>
                                    ))}
                                    {liveText && (
                                        <div className="p-4 border rounded bg-gray-50">
                                            <h3 className="font-semibold mb-1">🎤 실시간</h3>
                                            <p>{liveText}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    )}

                    {/* 🟣 스크립트 탭 */}
                    {activeTab === "script" && (
                        <section className="space-y-2">
                            {!isReplayMode && (
                                <button onClick={runRefineScript} className="btn-blue mb-2">
                                    ✏️ 스크립트 갱신
                                </button>
                            )}
                            {refinedScript.length ? (
                                refinedScript.map((l, i) => (
                                    <p key={i} className="text-gray-700">
                                        {l.text}
                                    </p>
                                ))
                            ) : (
                                <p className="text-gray-400">출력 없음</p>
                            )}
                        </section>
                    )}
                </div>
            </main>

            {/* 🔹 오른쪽 패널 */}
            <div className="w-[30%] h-[800px]">
                <RightPanel
                    tabs={["memo", "gpt"]}
                    memoText={memoText}
                    setMemoText={setMemoText}
                    isEditing={isEditing}
                    setIsEditing={setIsEditing}
                    saveStatus={saveStatus}
                />
            </div>
        </div>
    );
}