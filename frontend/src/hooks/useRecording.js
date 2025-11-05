// hooks/useRecording.js
import { useState, useRef, useEffect } from "react";

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

export default function useRecording({ WS_URL, boardId, onData, onStartError }) {
  const [recordingState, setRecordingState] = useState("idle");

    const wsRef = useRef(null);
    const sidRef = useRef(null);
    const audioContextRef = useRef(null);
    const processorRef = useRef(null);
    const streamRef = useRef(null);
    const sourceRef = useRef(null);
    const pausedRef = useRef(false);
    const currentBoardIdRef = useRef(null); // ✅ boardId를 ref로 관리

  // ✅ 항상 최신 boardId를 참조하도록 ref로 보관
  const boardIdRef = useRef(boardId);
  useEffect(() => {
    boardIdRef.current = boardId;
  }, [boardId]);

  const startRecording = async (overrideBoardId) => {
    if (recordingState !== "idle") return;

    try {
      setRecordingState("recording");
      pausedRef.current = false;

      // ✅ 호출 시점의 최신 boardId 확보
      const id = overrideBoardId ?? boardIdRef.current;
      console.log("useRecording.startRecording() id =", id, "override =", overrideBoardId, "ref =", boardIdRef.current);
      if (!id) throw new Error("boardId is required to start recording");

      // 1) WebSocket 연결 (board_id를 쿼리 파라미터로 전달)
      const wsUrl = `${WS_URL}?board_id=${id}`;
      console.log("🔌 WS connect:", wsUrl);
      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = "arraybuffer";

      wsRef.current.onopen = () => {
        console.log("✅ WS connected:", wsUrl);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.event === "session_started" && msg.sid) {
            sidRef.current = msg.sid;
            console.log("🎙️ sid assigned:", msg.sid);
          }

          onData?.(msg);
        } catch (err) {
          console.error("❌ JSON parse error:", err);
        }
      };

      wsRef.current.onerror = (e) => console.error("❌ WS error:", e);
      wsRef.current.onclose = (e) => console.log("🔌 WS closed:", e.code, e.reason);

      // 2) 오디오 캡처 & PCM 전송
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });

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
    } catch (err) {
      console.error("❌ Recording start failed:", err);
      setRecordingState("idle");
      onStartError?.(err);
      throw err;
    }
  };

    const pauseRecording = async () => {
        if (recordingState !== "recording") return;
        pausedRef.current = true;
        setRecordingState("paused");

    if (audioContextRef.current?.state === "running") {
      try {
        await audioContextRef.current.suspend();
        console.log("⏸️ audio context suspended");
      } catch (e) {
        console.warn("suspend failed:", e);
      }
    }
  };

    const resumeRecording = async () => {
        if (recordingState !== "paused") return;
        pausedRef.current = false;

    if (audioContextRef.current?.state === "suspended") {
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
        if (recordingState === "idle") return null;

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
        await audioContextRef.current.close();
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

    return sidRef.current;
  };

  return {
    recordingState,
    startRecording,   // ← 이제 (id) 넘길 수 있음
    pauseRecording,
    resumeRecording,
    stopRecording,
    sidRef,
  };
}
