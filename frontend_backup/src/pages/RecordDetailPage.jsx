import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useState, useEffect } from "react";
import { updateMemo, updateFolder } from "../features/record/recordSlice";
import RightPanel from "../components/recording/RightPanel";
import FolderDropdown from "../components/recording/FolderDropdown";

export default function RecordDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { records, folders } = useSelector((state) => state.record);
    const record = records.find((r) => String(r.id) === id);

    const [leftTab, setLeftTab] = useState("record");
    const [memoText, setMemoText] = useState(record?.memo || "# 메모 작성\n- 자동 저장됩니다.");
    const [isEditing, setIsEditing] = useState(false);
    const [saveStatus, setSaveStatus] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);

    // ✅ 메모 자동 저장
    useEffect(() => {
        if (!record) return;
        const timeout = setTimeout(() => {
            dispatch(updateMemo({ id: record.id, memo: memoText }));
            setSaveStatus("저장 완료!");
            setTimeout(() => setSaveStatus(""), 2000);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [memoText, record, dispatch]);

    // ✅ 폴더 선택 처리
    const handleFolderSelect = (folder) => {
        if (!folder) return setShowDropdown(false); // 외부 클릭 시 닫기
        dispatch(updateFolder({ id: record.id, folderId: folder.id }));
        setShowDropdown(false);
    };

    if (!record) {
        return (
            <main className="flex flex-col items-center justify-center min-h-screen text-gray-500">
                <p>회의록을 찾을 수 없습니다.</p>
                <button
                    onClick={() => navigate(-1)}
                    className="mt-4 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                    돌아가기
                </button>
            </main>
        );
    }

    // 날짜 포맷: 10.13 수 오후 01:12
    const dateStr = new Date(record.created_at || record.date).toLocaleString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <main className="bg-gray-50 min-h-screen p-8">
            {/* 뒤로가기 */}
            <button
                onClick={() => navigate(-1)}
                className="text-sm text-gray-400 hover:text-gray-600 mb-4"
            >
                ← 뒤로가기
            </button>

            <div className="flex gap-6">
                {/* ===== 왼쪽 섹션 ===== */}
                <section className="flex-1 bg-white rounded-2xl shadow-sm p-6 min-h-[800px] flex flex-col">
                    {/* ===== 상단 제목 / 날짜 / 폴더 ===== */}
                    <div className="mb-6">
                        {/* 제목 (즉시 수정 가능) */}
                        <input
                            type="text"
                            value={record.title}
                            onChange={(e) => (record.title = e.target.value)}
                            className="text-xl font-semibold w-full border-none focus:ring-0 outline-none mb-1"
                        />

                        {/* 날짜 */}
                        <p className="text-xs text-gray-400 mb-2">{dateStr}</p>

                        {/* 폴더 선택 버튼 */}
                        <div className="relative inline-block">
                            <button
                                onClick={() => setShowDropdown((prev) => !prev)}
                                className="text-xs text-[#7E37F9] bg-[#f5f2fb] px-3 py-1 rounded-md hover:bg-[#ece3ff]"
                            >
                                {record.folderName || "폴더에 넣기"}
                            </button>

                            {showDropdown && (
                                <FolderDropdown
                                    folders={folders}
                                    currentFolder={record.folder}
                                    onSelect={handleFolderSelect}
                                />
                            )}
                        </div>
                    </div>

                    {/* ===== 탭 ===== */}
                    <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
                        {[
                            { key: "record", label: "회의기록" },
                            { key: "script", label: "스크립트" },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setLeftTab(tab.key)}
                                className={`px-4 py-1.5 text-sm font-medium transition ${
                                    leftTab === tab.key
                                        ? "border-b-2 border-[#7E37F9] text-[#7E37F9]"
                                        : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ===== 내용 ===== */}
                    <div className="flex-1 overflow-y-auto">
                        {leftTab === "record" && (
                            <div className="whitespace-pre-line text-sm text-gray-700 leading-relaxed">
                                {record.description || "이 회의에는 아직 요약 내용이 없습니다."}
                            </div>
                        )}

                        {leftTab === "script" && (
                            <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
                                {record.transcripts?.length ? (
                                    record.transcripts.map((line, idx) => <p key={idx}>{line}</p>)
                                ) : (
                                    <p className="text-gray-400">스크립트 데이터가 없습니다.</p>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* ===== 오른쪽 패널 ===== */}
                <RightPanel
                    tabs={["memo", "gpt"]}
                    memoText={memoText}
                    setMemoText={setMemoText}
                    isEditing={isEditing}
                    setIsEditing={setIsEditing}
                    saveStatus={saveStatus}
                />
            </div>
        </main>
    );
}
