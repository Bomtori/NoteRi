import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

export default function ProtectedRoute({ children, requiredRole }) {
    const { isAuthenticated } = useSelector((state) => state.auth);
    const user = useSelector((state) => state.auth.user);
    const token = localStorage.getItem("access_token");
    const location = useLocation();

    // ✅ /record/:id 경로는 완전히 제외 (게스트 접근 허용)
    const isRecordDetailPage = /^\/record\/\d+$/.test(location.pathname);
    
    if (isRecordDetailPage) {
        // 이 경로는 ProtectedRoute를 거치지 않아야 함
        return children ? children : <Outlet />;
    }

    // 🔹 로그인 보호가 필요한 경로들
    const protectedPaths = [
        "/record",      // 회의 목록 (로그인 필수)
        "/folder",      // 폴더 관리 (로그인 필수)
        "/new",         // 새 회의 생성 (로그인 필수)
        "/user",        // 사용자 설정 (로그인 필수)
        "/payments",    // 결제 (로그인 필수)
        "/shared"       // 공유된 회의 (로그인 필수)
    ];
    
    // ✅ 정확한 경로 매칭 (하위 경로 제외)
    const isProtected = protectedPaths.some((path) => {
        if (path === "/record") {
            // /record 정확히 일치할 때만 보호
            return location.pathname === "/record";
        }
        return location.pathname.startsWith(path);
    });

    // 🔹 로그인 필수 경로인데 인증 안 됨 → /login 리디렉션
    if (isProtected && (!token || !isAuthenticated)) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 🔹 관리자 전용 페이지
    if (requiredRole === "admin" && user?.role !== "admin") {
        return <Navigate to="/" replace />;
    }

    return children ? children : <Outlet />;
}