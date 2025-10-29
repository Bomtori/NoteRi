import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import AuthLayout from "./layouts/AuthLayout";
import ProtectedRoute from "./components/common/ProtectedRoute";

import LandingPage from "./pages/LandingPage";
import RecordListPage from "./pages/RecordListPage";
import FolderListPage from "./pages/FolderListPage";
import NewRecordPage from "./pages/NewRecordPage";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
// import RecordDetailPage from "./pages/RecordDetailPage.jsx";
import UserPage from "./pages/UserPage.tsx";
// import MeetingPage from "./pages/MeetingPage.jsx";
import PaymentSuccessPage from "./pages/PaymentSuccessPage.tsx";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminUserPage from "./pages/AdminUserPage";


export default function App() {
    return (
        <Router>
            <Routes>
                {/* 공개 라우트 */}
                {/* 랜딩 페이지 (사이드바 없음) */}
                <Route path="/" element={<LandingPage />} />
                {/* 로그인 페이지 (사이드바 없음) */}
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/auth/callback" element={<AuthCallbackPage />} />
                </Route>
                {/* 보호된 페이지 (로그인 필요) */}
                <Route
                    element={
                        <ProtectedRoute>
                            <MainLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route path="/record" element={<RecordListPage />} />
                    <Route path="/folder/:id" element={<FolderListPage />} />
                    <Route path="/record/:id" element={<NewRecordPage />} />
                    <Route path="/new" element={<NewRecordPage />} />
                    <Route path="/user" element={<UserPage />} />
                    <Route path="/payments/success" element={<PaymentSuccessPage />} />
                    {/*<Route path="/meeting" element={<MeetingPage />} />*/}
                </Route>
                {/* ✅ 관리자 전용 페이지 (신규 추가) */}
                <Route
                    path="/admin/*"
                    element={
                        <ProtectedRoute requiredRole="admin">
                            <AdminLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="users" element={<AdminUserPage />} />
                </Route>
            </Routes>
        </Router>
    );
}