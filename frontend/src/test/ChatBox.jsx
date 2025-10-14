// frontend/src/components/ChatBox.jsx
import React, { useState } from "react";

const BASE_URL = "http://localhost:8000";

export default function ChatBox() {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [meta, setMeta] = useState(null);
  const [ping, setPing] = useState("");
  const [loading, setLoading] = useState(false);

  const requestChat = async (p, { debug = false } = {}) => {
    const url = new URL(`${BASE_URL}/ai/chat`);
    if (debug) url.searchParams.set("debug", "true");
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: p, temperature: 0.2, max_output_tokens: 64 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json(); // { text, meta, empty }
  };

  const handleSend = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setAnswer("");
    setMeta(null);
    try {
      // 1차 시도
      let data = await requestChat(prompt);
      setMeta(data.meta || null);

      // 빈 응답이면 debug 모드로 1회 재시도(서버 힌트/폴백 후 메타 확인)
      if (data.empty) {
        const data2 = await requestChat(prompt, { debug: true });
        data = data2; // 덮어쓰기
      }

      setAnswer((data.text && data.text.trim()) ? data.text : "(empty response)");
      setMeta(data.meta || null);
    } catch (err) {
      setAnswer(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePing = async () => {
    try {
      const res = await fetch(`${BASE_URL}/ai/ping`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPing(data.ok ? `✅ pong (${data.text})` : `❌ failed (${data.text})`);
    } catch (err) {
      setPing(`❌ error: ${err.message}`);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>💬 Gemini Chat (via FastAPI)</h2>

      <div style={styles.inputRow}>
        <input
          type="text"
          value={prompt}
          placeholder="Type your prompt..."
          onChange={(e) => setPrompt(e.target.value)}
          style={styles.input}
        />
        <button onClick={handleSend} disabled={loading} style={{ ...styles.button, background: "#0078ff" }}>
          {loading ? "Thinking..." : "Send"}
        </button>
        <button onClick={handlePing} style={{ ...styles.button, background: "#0a0" }}>
          Ping
        </button>
      </div>

      <div style={styles.resultBox}>
        <div style={styles.label}>Response</div>
        <pre style={styles.answer}>{answer}</pre>
        {meta && (
          <div style={styles.meta}>
            <div>model: <b>{meta.model}</b></div>
            <div>api: <b>{meta.api}</b></div>
            {meta.error && <div>error: <code>{meta.error}</code></div>}
          </div>
        )}
      </div>

      <div style={styles.ping}>Ping: {ping}</div>
    </div>
  );
}

const styles = {
  container: { fontFamily: "system-ui, sans-serif", maxWidth: 700, margin: "60px auto", padding: 20, border: "1px solid #ddd", borderRadius: 12, background: "#fafafa" },
  title: { textAlign: "center", marginBottom: 24 },
  inputRow: { display: "flex", gap: 8, marginBottom: 16 },
  input: { flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15 },
  button: { color: "white", border: "none", borderRadius: 8, padding: "10px 14px", cursor: "pointer", fontWeight: 600 },
  resultBox: { background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 12 },
  label: { fontWeight: 600, marginBottom: 6 },
  answer: { whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 15 },
  meta: { marginTop: 8, paddingTop: 8, borderTop: "1px dashed #ddd", color: "#555", fontSize: 13 },
  ping: { marginTop: 10, color: "#555", fontSize: 14 },
};
