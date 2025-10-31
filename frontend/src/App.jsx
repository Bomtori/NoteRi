import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// import { ToastProvider } from "./hooks/useToast.js";
import MainLayout from "./layouts/MainLayout";
import AuthLayout from "./layouts/AuthLayout";
import ProtectedRoute from "./components/common/ProtectedRoute";

import LandingPage from "./pages/LandingPage";
import RecordListPage from "./pages/RecordListPage";
import FolderListPage from "./pages/FolderListPage";
import NewRecordPage from "./pages/NewRecordPage";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminDashBoardPage from "./pages/AdminDashBoardPage";
import RecordDetailPage from "./pages/RecordDetailPage.jsx";
import UserPage from "./pages/UserPage.tsx";
import PaymentSuccessPage from "./pages/PaymentSuccessPage.tsx";
import AdminLayout from "./layouts/AdminLayout";
import AdminUserPage from "./pages/AdminUserPage";
import MeetingPage from "./pages/MeetingPage";
import RecordShareModal from "@/components/recording/RecordShareModal.jsx";
import SharedFolderPage from "@/pages/SharedFolderPage.jsx";


export default function App() {
    return (
        // <ToastProvider>
            <Router>
                <Routes>
                    {/* 🔹 공개 라우트 (로그인 필요 없음) */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/meeting" element={<MeetingPage />} />


                    {/* 🔹 로그인 및 인증 관련 페이지 */}
                    <Route element={<AuthLayout />}>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/auth/callback" element={<AuthCallbackPage />} />
                    </Route>

                    {/* 🔹 게스트 접근 허용 라우트
                - 비밀번호 보호된 회의 (PIN 입력)
                - 로그인 없이 접근 가능
                - ?protected=true 있을 경우 PIN 입력창 표시 */}
                    <Route
                        path="/record/:id"
                        element={
                            <MainLayout>
                                <RecordDetailPage />
                            </MainLayout>
                        }
                    />

                    {/* 🔹 로그인 필수 라우트 (보호 구역) */}
                    <Route
                        element={
                            <ProtectedRoute>
                                <MainLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="/record" element={<RecordListPage />} />
                        <Route path="/shared" element={<SharedFolderPage  />} />
                        <Route path="/folder/:id" element={<FolderListPage />} />
                        <Route path="/new" element={<NewRecordPage />} />
                        <Route path="/user" element={<UserPage />} />
                        <Route path="/payments/success" element={<PaymentSuccessPage />} />
                    </Route>

                    {/* 🔹 관리자 전용 라우트 */}
                    <Route
                        path="/admin/*"
                        element={
                            <ProtectedRoute requiredRole="admin">
                                <AdminLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<AdminDashBoardPage />} />
                        <Route path="users" element={<AdminUserPage />} />
                        <Route path="settings" element={<AdminSettingsPage />} />
                    </Route>
                </Routes>
            </Router>
        // </ToastProvider>
    );
}
