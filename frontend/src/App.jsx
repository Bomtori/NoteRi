import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthLayout from "./layouts/AuthLayout";
// import PaymentButton from "./PaymentButton";              // ← 당장 안 쓰면 주석
// import PaymentSuccess from "./PaymentSuccess";            // ← 중복 방지 위해 주석
import PaymentFail from "./PaymentFail";
import ChatBox from "./test/ChatBox";
import LoginPage from "./pages/LoginPage.jsx";
import AuthCallback from "./test/AuthCallback.jsx";
// import DashBoard from "./test/components/DashBoard.jsx";  // ← 임시 주석
import LandingPage from "./pages/LandingPage";
import RecordListPage from "./pages/RecordListPage";
import FolderListPage from "./pages/FolderListPage";
import NewRecordPage from "./pages/NewRecordPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import RecordDetailPage from "./pages/RecordDetailPage.jsx";
import UserPage from "./pages/UserPage.tsx";
import MeetingPage from "./pages/MeetingPage.jsx";
import PaymentSuccessPage from "./pages/PaymentSuccessPage.tsx";

// 임시 대시보드 플레이스홀더 (라우트 유지하고 싶으면 사용)
const DashboardPlaceholder = () => (
  <div style={{ padding: 16 }}>Dashboard 준비 중…</div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 메인 */}
        <Route path="/" element={<LandingPage />} />

        {/* 로그인/콜백 (AuthLayout 적용) */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Route>

        {/* 테스트 라우트들 */}
        <Route path="/test" element={<LoginPage />} />
        <Route path="/test/auth/callback" element={<AuthCallback />} />
        <Route path="/test/chat" element={<ChatBox />} />
        <Route path="/test/login" element={<LoginPage />} />

        {/* 결제 관련 (중복 제거: success는 Page 버전만 사용) */}
        {/* <Route path="/" element={<PaymentButton />} />  ← "/"와 중복이라 잠시 비활성 */}
        {/* 필요하면: <Route path="/pay" element={<PaymentButton />} /> 로 변경 */}
        <Route path="/payments/success" element={<PaymentSuccessPage />} />
        <Route path="/payments/fail" element={<PaymentFail />} />

        {/* 대시보드 (임시 placeholder로 대체) */}
        <Route path="/home" element={<DashboardPlaceholder />} />
        {/* 실제 파일이 준비되면 위 한 줄을
            <Route path="/home" element={<DashBoard />} />
            로 바꾸고 상단 import 주석을 해제하세요. */}

        {/* 기록/폴더/사용자/미팅 */}
        <Route path="/record" element={<RecordListPage />} />
        <Route path="/folder/:id" element={<FolderListPage />} />
        <Route path="/record/:id" element={<RecordDetailPage />} />
        <Route path="/new" element={<NewRecordPage />} />
        <Route path="/user" element={<UserPage />} />
        <Route path="/meeting" element={<MeetingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
