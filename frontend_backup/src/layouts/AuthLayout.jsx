import { Outlet } from "react-router-dom";

export default function AuthLayout() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-10">
                <Outlet />
            </div>
        </div>
    );
}
