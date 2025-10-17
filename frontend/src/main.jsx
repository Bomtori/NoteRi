import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

// 페이지 컴포넌트 import
import App from "./App.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";
import PaymentButton from "./PaymentButton.jsx";
import PaymentSuccess from "./PaymentSuccess.jsx";
import PaymentFail from "./PaymentFail.jsx";
import ChatBox from "./test/ChatBox.jsx";
import LoginPage from "./test/LoginPage.jsx";
import AuthCallback from "./test/AuthCallback.jsx";
import DashBoard from "./test/components/DashBoard.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* 기본 경로를 /meeting 으로 리다이렉트 */}
          <Route path="/test" element={<LoginPage/> } />
          <Route path="/test/auth/callback" element={<AuthCallback/>}/>
          <Route path="/test/chat" element={<ChatBox/>}/>
          <Route path="/test/login" element={<LoginPage/>}/>
        <Route path="/" element={<Navigate to="/meeting" replace />} />
        <Route path="/meeting" element={<MeetingPage />} />
        <Route path="/pay" element={<PaymentButton />} />
        <Route path="/pay/success" element={<PaymentSuccess />} />
        <Route path="/pay/fail" element={<PaymentFail />} />
          <Route path="/home" element={<DashBoard/>}/>
        {/* 나중에 App 안쪽 페이지들을 여기에 추가할 수도 있음 */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
