// src/pages/GeminiChatBox.jsx
// src/pages/GeminiChatBox.jsx
import React, { useState, useEffect } from "react";
const API_BASE = "http://localhost:8000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export default function GeminiChatBox() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    const token = getToken();
    if (!token) { setError("로그인이 필요합니다."); return; }
    try {
      const res = await fetch(`${API_BASE}/gemini/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("access_token");
        setError("세션이 만료되었습니다. 다시 로그인해주세요.");
        return;
      }
      const data = await res.json();
      setHistory(data.items || []);
    } catch {
      setError("히스토리를 불러올 수 없습니다.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) { setError("로그인이 필요합니다."); return; }

    try {
      setLoading(true); setResponse(""); setError(null);
      const res = await fetch(`${API_BASE}/gemini/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt }),
      });
      if (res.status === 401) {
        localStorage.removeItem("access_token");
        setError("세션이 만료되었습니다. 다시 로그인해주세요.");
        return;
      }
      const data = await res.json();
      setResponse(data.text || "(응답 없음)");
      setHistory((prev) => [{
        id: Date.now(),
        prompt_text: prompt,
        response_text: data.text,
        created_at: new Date().toISOString(),
      }, ...prev]);
      setPrompt("");
    } catch {
      setError("응답 생성 실패");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: 20 }}>
      <h2>Gemini Chat</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <button type="submit" disabled={loading}>{loading ? "생성 중..." : "보내기"}</button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {response && (
        <div style={{ marginTop: 16, padding: 12, background: "#f6f7f9", borderRadius: 8 }}>
          <strong>응답</strong>
          <div>{response}</div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h3>이전 대화</h3>
        {history.length === 0 ? (
          <div style={{ color: "#666" }}>기록 없음</div>
        ) : (
          history.map((item) => (
            <div key={item.id} style={{ borderTop: "1px solid #eee", padding: "8px 0" }}>
              <div><b>Q:</b> {item.prompt_text}</div>
              <div><b>A:</b> {item.response_text || "(빈 응답)"}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{new Date(item.created_at).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


const styles = {
  container: {
    maxWidth: "700px",
    margin: "40px auto",
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    fontFamily: "Inter, sans-serif",
  },
  header: { textAlign: "center" },
  logoutBtn: {
    float: "right",
    background: "#ef4444",
    color: "white",
    border: "none",
    padding: "6px 12px",
    borderRadius: 6,
    cursor: "pointer",
  },
  form: { display: "flex", flexDirection: "column", gap: "10px" },
  textarea: {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    resize: "vertical",
    fontSize: "14px",
  },
  button: {
    alignSelf: "flex-end",
    padding: "8px 16px",
    borderRadius: "8px",
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },
  error: { color: "red", marginTop: "10px" },
  responseBox: {
    backgroundColor: "#f8fafc",
    borderRadius: "8px",
    padding: "12px",
    marginTop: "20px",
    border: "1px solid #e2e8f0",
  },
  historyBox: { marginTop: "30px" },
  historyItem: { borderTop: "1px solid #eee", padding: "10px 0" },
  prompt: { fontWeight: "bold", color: "#111" },
  answer: { color: "#333", marginTop: "4px" },
  time: { color: "#999", fontSize: "12px", marginTop: "4px" },
};
