import { useState } from "react";
import apiClient from "../../api/apiClient";
import useLogout from "../../hooks/useLogout";

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
    const handleLogout = useLogout(); // ✅ 훅만 남김
    const isDefaultAvatar =
  preview?.includes("Group_48") || preview?.includes("Group_49");

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

    const handleNicknameSave = async () => {
        try {
            await apiClient.patch("/users/me", { nickname });
            alert("닉네임이 변경되었습니다 ✅");
        } catch (err) {
            console.error("닉네임 수정 실패:", err);
        }
    };
    const grayBtn =
    "px-4 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 " +
    "hover:border-[#7E37F9] hover:text-[#7E37F9] hover:bg-[#F3EFFF] transition";

    const grayBtnRed =
    "px-4 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 " +
    "hover:border-red-400 hover:text-red-500 hover:bg-[#FFF5F5] transition";

const DEFAULT_AVATAR = "/static/uploads/Group_49.png"; // or API_BASE_URL + ...

const handleImageRemove = async () => {
  try {
    // 미리보기 기본 이미지로 교체
    setPreview(DEFAULT_AVATAR);

    // ⬇️ DELETE /profile/picture (prefix에 맞춰 수정)
    await apiClient.delete("/picture");

    alert("프로필 사진이 삭제되었습니다 ✅");
  } catch (err) {
    console.error("프로필 삭제 실패:", err);
    alert("프로필 삭제 중 오류가 발생했습니다.");
  }
};

   return (
         <section className="bg-white rounded-2xl p-6 shadow-sm flex gap-6">

            {/* 프로필 */}
             <div className="flex flex-col items-center shrink-0">
  <div className="relative">
    <img
      src={preview}
      className="w-24 h-24 rounded-full object-cover border border-gray-200"
    />

    {/* X 버튼: 기본 아바타가 아닐 때만 표시 */}
    {!isDefaultAvatar && preview && (
      <button
        type="button"
        onClick={handleImageRemove}
        className="
          absolute -top-1 -right-1
          w-6 h-6 rounded-full
          bg-black/60 text-white text-xs
          flex items-center justify-center
          hover:bg-black transition
        "
      >
        ✕
      </button>
    )}
  </div>

  {/* 변경 버튼 */}
  <label className={`${grayBtn} mt-3 cursor-pointer`}>
    변경
    <input
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleImageChange}
    />
  </label>
</div>

            {/* 오른쪽 영역 */}
            <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 min-w-0">
                    <input
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        onBlur={handleNicknameSave}
                        className="flex-1 min-w-0 text-lg font-semibold outline-none border-b border-transparent focus:border-[#7E37F9]"
                    />

                    {/* 저장 버튼 */}
                    <button className={grayBtn} onClick={handleNicknameSave}>
                        저장
                    </button>
                </div>

                <p className="text-sm text-gray-600">{user.email}</p>
                <p className="text-xs text-gray-400 mt-1">로그인 계정: {user.oauth_provider}</p>
                <p className="text-xs text-gray-400 mt-1">
                    가입일: {new Date(user.created_at).toLocaleDateString("ko-KR")}
                </p>

                {/* 로그아웃 버튼 */}
                <button className={`${grayBtnRed} w-fit mt-3`}
                        onClick={() => handleLogout(user.oauth_provider)}>
                    로그아웃
                </button>
            </div>
        </section>
    );
}