import { useState } from "react";
import apiClient from "../../api/apiClient";

interface Props {
    user: {
        picture: string;
        nickname: string;
        email: string;
        oauth_provider: string;
        created_at: string;
    };
}

export default function UserHeader({ user }: Props) {
    const [nickname, setNickname] = useState(user.nickname);
    const [preview, setPreview] = useState(user.picture);

    // ✅ 프로필 이미지 변경
    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const localPreview = URL.createObjectURL(file);
        setPreview(localPreview);

        try {
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await apiClient.post("/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const uploadedUrl = uploadRes.data.url;
            await apiClient.patch("/users/me", { picture: uploadedUrl });
            alert("프로필 사진이 변경되었습니다 ✅");
        } catch (err) {
            console.error("이미지 업로드 실패:", err);
            alert("이미지 업로드 중 오류가 발생했습니다.");
        }
    };

    // ✅ 닉네임 수정
    const handleNicknameSave = async () => {
        try {
            await apiClient.patch("/users/me", { nickname });
            alert("닉네임이 변경되었습니다 ✅");
        } catch (err) {
            console.error("닉네임 수정 실패:", err);
        }
    };

    // ✅ 통합 로그아웃
    const handleLogout = async () => {
        try {
            await apiClient.get(`/auth/logout?provider=${user.oauth_provider}`);
            localStorage.removeItem("access_token");
            localStorage.removeItem("user");
            window.location.href = "/login";
        } catch (err) {
            console.error("로그아웃 실패:", err);
        }
    };

    return (
        <section className="bg-white rounded-2xl p-6 shadow-sm flex items-center gap-6">
            {/* 프로필 이미지 */}
            <div className="relative">
                <img
                    src={preview}
                    alt="프로필"
                    className="w-24 h-24 rounded-full object-cover border border-gray-200"
                />
                <label className="absolute bottom-0 right-0 bg-[#7E37F9] text-white text-xs px-2 py-1 rounded-md cursor-pointer">
                    변경
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                    />
                </label>
            </div>

            {/* 사용자 정보 */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <input
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        onBlur={handleNicknameSave}
                        className="text-lg font-semibold outline-none border-b border-transparent focus:border-[#7E37F9]"
                    />
                    <button
                        onClick={handleNicknameSave}
                        className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                    >
                        저장
                    </button>
                </div>

                <p className="text-sm text-gray-600">{user.email}</p>
                <p className="text-xs text-gray-400 mt-1">
                    로그인 계정: {user.oauth_provider || "unknown"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    가입일: {new Date(user.created_at).toLocaleDateString("ko-KR")}
                </p>

                <button
                    onClick={handleLogout}
                    className="mt-3 px-3 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200"
                >
                    로그아웃
                </button>
            </div>
        </section>
    );
}
