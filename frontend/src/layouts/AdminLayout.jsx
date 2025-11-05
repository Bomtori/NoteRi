import { Outlet } from "react-router-dom";
import AdminSidebar from "../components/admin/AdminSidebar";

export default function AdminLayout() {
    return (
        <div className="flex bg-gray-50 min-h-screen">
          {/* 사이드바 */}
          <AdminSidebar />
                 {/* 메인 콘텐츠 영역 */}
          <main className="flex-1 p-6 ">
            <Outlet />
          </main>
        </div>
    );
}
