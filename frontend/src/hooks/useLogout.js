import { useDispatch } from "react-redux";
import { logout } from "../features/auth/authSlice";
import { API_BASE_URL } from "../config";

export default function useLogout() {
    const dispatch = useDispatch();

    const handleLogout = (provider) => {
        // 백엔드 쿠키 로그아웃
        window.location.href = `${API_BASE_URL}/auth/logout?provider=${provider}`;

        // Redux & localStorage 초기화
        dispatch(logout());
    };

    return handleLogout;
}
