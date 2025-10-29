import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

export default function ProtectedRoute({ children, requiredRole }) {
    const { token, isAuthenticated, user } = useSelector((state) => state.auth);
    const hasToken = token || localStorage.getItem("access_token");
    const location = useLocation();

    // 기존 보호 경로 그대로 유지
    const protectedPaths = ["/record", "/folder", "/new", "/user", "/payments"];
    const isProtected = protectedPaths.some((path) =>
        location.pathname.startsWith(path)
    );

    // 기존 로직 유지 (로그인 안 되어 있으면 로그인 페이지로)
    if (isProtected && (!hasToken || !isAuthenticated)) {
        return <Navigate to="/login" replace />;
    }

    // ✅ 관리자 전용 페이지 접근 제어 추가
    // if (requiredRole === "admin" && user?.role !== "admin") {
    //     return <Navigate to="/" replace />;
    // }

    // children이 있으면 children, 없으면 Outlet
    return children ? children : <Outlet />;
}
