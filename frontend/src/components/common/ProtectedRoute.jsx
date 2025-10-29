import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

export default function ProtectedRoute({ children, requiredRole }) {
    const { isAuthenticated, user } = useSelector((state) => state.auth);
    const token = localStorage.getItem("access_token");
    const location = useLocation();

    // 🔹 URL 파라미터로 게스트 접근 허용 여부 확인
    const isGuestAccess =
        new URLSearchParams(location.search).get("protected") === "true";

    // 🔹 로그인 보호가 필요한 경로 정의
    const protectedPaths = ["/record", "/folder", "/new", "/user", "/payments"];
    const isProtected = protectedPaths.some((path) =>
        location.pathname.startsWith(path)
    );

    // 🔹 보호된 경로인데 (게스트 접근이 아님) 로그인 안 됐을 경우 → /login 리디렉션
    if (isProtected && !isGuestAccess && (!token || !isAuthenticated)) {
        return <Navigate to="/login" replace />;
    }

    // 🔹 관리자 전용 페이지 접근 제어
    if (requiredRole === "admin" && user?.role !== "admin") {
        return <Navigate to="/" replace />;
    }

    // 🔹 children이 있으면 children, 없으면 Outlet
    return children ? children : <Outlet />;
}
