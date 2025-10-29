import React from "react";

// src/pages/LoginPage.jsx
export default function LoginPage() {
  const API_BASE = "http://localhost:8000";
  return (
    <div style={{ textAlign: "center", marginTop: 160 }}>
      <button onClick={() => (window.location.href = `${API_BASE}/auth/google/login`)}>
        Google로 로그인
      </button>
    </div>
  );
}


const styles = {
  container: {
    maxWidth: 400,
    margin: "150px auto",
    textAlign: "center",
    fontFamily: "Inter, sans-serif",
  },
  button: {
    marginTop: 20,
    padding: "10px 20px",
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid #ccc",
    cursor: "pointer",
    background: "white",
  },
};