import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthLayout from "./layouts/AuthLayout";
import PaymentButton from "./PaymentButton";
import PaymentSuccess from "./PaymentSuccess";
import PaymentFail from "./PaymentFail";
import ChatBox from "./test/ChatBox";
import LoginPage from "./pages/LoginPage.jsx";
import AuthCallback from "./test/AuthCallback.jsx";
import DashBoard from "../../frontend/src/pages/AdminDashboardPage.tsx"
import LandingPage from "./pages/LandingPage";
import RecordListPage from "./pages/RecordListPage";
import FolderListPage from "./pages/FolderListPage";
import NewRecordPage from "./pages/NewRecordPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import RecordDetailPage from "./pages/RecordDetailPage.jsx";
import UserPage from "./pages/UserPage.tsx";
import MeetingPage from "./pages/MeetingPage.jsx";
import PaymentSuccessPage from "./pages/PaymentSuccessPage.tsx";
import Calendar from "../../frontend/src/components/calendar/Calendar.js";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
         {/* 로그인 페이지 (사이드바 없음) */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Route>
        <Route path="/test" element={<LoginPage/> } />
              <Route path="/test/auth/callback" element={<AuthCallback/>}/>
              <Route path="/test/chat" element={<ChatBox/>}/>
          <Route path="/test/login" element={<LoginPage/>}/>
        <Route path="/" element={<PaymentButton />} />
        <Route path="/payments/success" element={<PaymentSuccess />} />
        <Route path="/payments/fail" element={<PaymentFail />} />
        <Route path="/home" element={<DashBoard/>}/>
        <Route path="/record" element={<RecordListPage />} />
                        <Route path="/folder/:id" element={<FolderListPage />} />
                        <Route path="/record/:id" element={<RecordDetailPage />} />
                        <Route path="/new" element={<NewRecordPage />} />
                        <Route path="/user" element={<UserPage />} />
                        <Route path="/meeting" element={<MeetingPage />} />
                        <Route path="/payments/success" element={<PaymentSuccessPage />} />
          <Route path="/calendar" element={<Calendar/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
