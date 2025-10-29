import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

export default function ProtectedRoute() {
    const { token, isAuthenticated } = useSelector((state) => state.auth);

    // Redux 상태 또는 localStorage에서 토큰 확인
    const hasToken = token || localStorage.getItem("access_token");

    if (!hasToken || !isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />; // 내부 라우트 렌더링
}
