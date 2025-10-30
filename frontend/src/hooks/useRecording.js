import { useRef, useState } from "react";

export default function useRecording({ WS_URL, boardId, onData, onStartError }) {
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const pausedRef = useRef(false);

  const [recordingState, setRecordingState] = useState("idle");

  // 🔹 Float → PCM 변환
  const floatTo16BitPCM = (float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  // 🎙️ 녹음 시작
  const startRecording = async () => {
    if (recordingState !== "idle") return;
    setRecordingState("recording");

    try {
      // ✅ board_id를 query parameter로 포함
      let wsUrl = WS_URL;
      if (boardId) {
        const separator = WS_URL.includes('?') ? '&' : '?';
        wsUrl = `${WS_URL}${separator}board_id=${boardId}`;
      }
      console.log("🔌 WebSocket connecting to:", wsUrl);

      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = "arraybuffer";

      wsRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (onData) onData(msg);
        } catch (err) {
          console.error("❌ JSON parse error:", err);
        }
      };

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
      } catch (err) {
        console.error("❌ 녹음 시작 실패:", err);
        setRecordingState("idle");
        if (onStartError) onStartError(err);
      }
    };

  // ⏸️ 일시정지
  const pauseRecording = () => {
    pausedRef.current = true;
    setRecordingState("paused");
  };

  // ▶️ 다시시작
  const resumeRecording = () => {
    pausedRef.current = false;
    setRecordingState("recording");
  };

  // 🛑 종료
  const stopRecording = () => {
    pausedRef.current = true;
    if (processorRef.current) processorRef.current.disconnect();
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    setRecordingState("idle");
  };

  return {
    recordingState,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}
