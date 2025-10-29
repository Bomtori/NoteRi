// src/pages/GeminiChatBox.jsx
// src/pages/GeminiChatBox.jsx
import React, { useState, useEffect } from "react";
const API_BASE = "http://localhost:8000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export default function ChatBox() {
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
    <div className="max-w-[700px] mx-auto my-10 p-5 rounded-2xl border border-border bg-card text-card-foreground shadow-sm font-sans">
      <h2 className="text-xl font-semibold text-center">Gemini Chat</h2>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2">
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full min-h-[96px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background resize-y"
        />
        <button
          type="submit"
          disabled={loading}
          className="self-end inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        >
          {loading ? "생성 중..." : "보내기"}
        </button>
      </form>

      {error && <p className="text-destructive mt-2">{error}</p>}

      {response && (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          <strong className="block mb-1">응답</strong>
          <div>{response}</div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-base font-semibold">이전 대화</h3>
        {history.length === 0 ? (
          <div className="text-muted-foreground">기록 없음</div>
        ) : (
          history.map((item) => (
            <div key={item.id} className="border-t border-border py-2.5">
              <div><b>Q:</b> {item.prompt_text}</div>
              <div><b>A:</b> {item.response_text || "(빈 응답)"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}