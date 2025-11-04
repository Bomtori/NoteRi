// hooks/useRecording.js
import { useState, useRef } from "react";

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

// 9자리 숫자 sid 생성 (예: 223126628)
function genNumericSid() {
  const n = Math.floor(Math.random() * 1e9);
  return String(n).padStart(9, "0");
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

  const startRecording = async () => {
    if (recordingState !== "idle") return;

    // 0) boardId 필수
    if (!boardId && boardId !== 0) {
      const err = new Error("boardId is required to start recording");
      onStartError?.(err);
      return;
    }

    try {
      setRecordingState("connecting");
      pausedRef.current = false;

      // 1) sid 생성 + WS URL 구성
      sidRef.current = genNumericSid();
      const wsUrl = `${WS_URL}?board_id=${encodeURIComponent(boardId)}&sid=${encodeURIComponent(
        sidRef.current
      )}`;

      console.log("🔌 WebSocket 연결 시도:", wsUrl);
      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = "arraybuffer";

      // 2) WS open 대기 (open 되기 전엔 오디오 시작/전송 금지)
      await new Promise((resolve, reject) => {
        let resolved = false;

        wsRef.current.onopen = () => {
          console.log("✅ WS connected:", wsUrl);
          resolved = true;
          resolve();
        };
        wsRef.current.onerror = (e) => {
          if (!resolved) reject(e);
          console.error("❌ WS error:", e);
        };
        wsRef.current.onclose = (e) => {
          console.log("🔌 WS closed before start:", e.code, e.reason || "");
          if (!resolved) reject(new Error(`WS closed (${e.code}) ${e.reason || ""}`));
        };
        wsRef.current.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            // 서버가 session_started + sid를 보내줄 수도 있지만
            // 우리는 이미 sidRef.current를 URL로 넘겼으므로 참고만 함
            if (msg.event === "session_started" && msg.sid) {
              console.log("🎙️ server confirmed sid:", msg.sid);
            }
            onData?.(msg);
          } catch {
            // 서버가 바이너리/텍스트 섞어 보낼 수 있으니 조용히 패스
          }
        };
      });

      // 3) 오디오 캡처 & PCM 전송 (WS open 이후에만)
      setRecordingState("recording");

      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });

      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      sourceRef.current = source;

      processorRef.current = audioContextRef.current.createScriptProcessor(16384, 1, 1);
      processorRef.current.onaudioprocess = (e) => {
        if (pausedRef.current) return;
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const input = e.inputBuffer.getChannelData(0);
        const pcm = floatTo16BitPCM(input);
        ws.send(pcm);
      };

      source.connect(processorRef.current);
      // 일부 브라우저는 destination 연결이 필요함
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (err) {
      console.error("❌ Recording start failed:", err);
      setRecordingState("idle");
      onStartError?.(err);
      // WS가 열리다 실패하면 안전 정리
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    }
  };

  const pauseRecording = async () => {
    if (recordingState !== "recording") return;
    pausedRef.current = true;
    setRecordingState("paused");

    if (audioContextRef.current && audioContextRef.current.state === "running") {
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

    // 오디오 리소스 정리
    try {
      if (processorRef.current) {
        try {
          processorRef.current.disconnect();
        } catch {}
        processorRef.current.onaudioprocess = null;
        processorRef.current = null;
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {}
        sourceRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          await audioContextRef.current.close();
        } catch {}
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((t) => t.stop());
        } catch {}
        streamRef.current = null;
      }
    } catch (e) {
      console.warn("⚠️ cleanup warning:", e);
    }

    // WebSocket 정리 (열려 있으면 정상 종료 코드로)
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, "Normal Closure");
      }
    } catch {}
    wsRef.current = null;

    return sidRef.current; // 세션 ID 반환 (후속 API 콜 등에 사용)
  };

  return {
    recordingState,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    sidRef,
  };
}
