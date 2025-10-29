import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import apiClient from "../api/apiClient";
import { changeRecordFolder } from "../features/record/recordSlice";

// 🔹 Components
import RecordHeader from "../components/recording/RecordHeader";
import RecordTabs from "../components/recording/RecordTabs";
import RecordSection from "../components/recording/RecordSection";
import RecordBar from "../components/recording/RecordBar";
import RightPanel from "../components/recording/RightPanel";
import TemplateModal from "../components/recording/TemplateModal";
import { useToast } from "../hooks/useToast";

export default function RecordDetailPage() {
    const { id } = useParams(); // board_id
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { folders } = useSelector((state) => state.record);

    // 🔹 기본 상태
    const [board, setBoard] = useState(null);
    const [title, setTitle] = useState("");
    const [dateStr, setDateStr] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [activeTab, setActiveTab] = useState("record");
    const [isPanelVisible, setIsPanelVisible] = useState(false);
    const [activeGPTTab, setActiveGPTTab] = useState("memo");

    // 🔹 텍스트 & STT 데이터
    const [summaries, setSummaries] = useState([]);
    const [refinedScript, setRefinedScript] = useState([]);
    const [speakers, setSpeakers] = useState([]);

    // 🔹 Toast
    const { toast, showToast, clearToast } = useToast();

    // 🔹 회의 데이터 불러오기
    useEffect(() => {
        const fetchBoard = async () => {
            try {
                const res = await apiClient.get(`/boards/${id}`);
                const data = res.data;
                setBoard(data);
                setTitle(data.title);
                setDateStr(
                    new Date(data.created_at).toLocaleString("ko-KR", {
                        month: "2-digit",
                        day: "2-digit",
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                    })
                );
            } catch (err) {
                console.error("🔹 회의 불러오기 실패:", err);
            }
        };

        const fetchRecordingResults = async () => {
            try {
                const res = await apiClient.get(`/recording/result/${id}`);
                const items = res.data.items || [];

                // text 기반으로 summaries / script 구분
                const summariesArr = items
                    .filter((item) => item.summary)
                    .map((i) => ({ paragraph: i.paragraph, summary: i.summary }));
                const scriptsArr = items
                    .filter((i) => i.text || i.paragraph)
                    .map((i) => i.text || i.paragraph);

                setSummaries(summariesArr);
                setRefinedScript(scriptsArr);
            } catch (err) {
                console.error("🔹 녹음 결과 불러오기 실패:", err);
            }
        };

        fetchBoard();
        fetchRecordingResults();
    }, [id]);

    // 🔹 폴더 이동
    const handleFolderSelect = async (folder) => {
        if (!folder) return setShowDropdown(false);
        try {
            await apiClient.patch(`/boards/${id}/move`, { folder_id: folder.id });
            dispatch(changeRecordFolder({ id, folder }));
            setShowDropdown(false);
        } catch (err) {
            console.error("🔹 폴더 이동 실패:", err);
        }
    };

    // 🔹 템플릿 선택
    const handleSelectTemplate = (type) => {
        setShowTemplateModal(false);
        console.log("🔹 템플릿 실행:", type);
    };

    if (!board) {
        return (
            <main className="flex flex-col items-center justify-center min-h-screen text-gray-500">
                <p>회의록을 불러오는 중입니다...</p>
            </main>
        );
    }

    return (
        <motion.div
            className="relative overflow-hidden min-h-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
        >
            <div className="p-6">
                <button
                    onClick={() => navigate(-1)}
                    className="text-sm text-gray-400 hover:text-gray-600 mb-4"
                >
                    ← 뒤로가기
                </button>

                <div className="grid grid-cols-[1fr_360px] gap-6">
                    {/* 🔹 메인 컨텐츠 */}
                    <main className="bg-white rounded-2xl p-6 shadow-sm flex flex-col h-[calc(100vh-140px)]">
                        <RecordHeader
                            title={title}
                            setTitle={setTitle}
                            dateStr={dateStr}
                            boardId={board.id}
                            folders={folders}
                            showDropdown={showDropdown}
                            setShowDropdown={setShowDropdown}
                            onSelectFolder={handleFolderSelect}
                        />

                        <RecordTabs tabs={[
                            { id: "record", label: "회의기록" },
                            { id: "script", label: "스크립트" },
                        ]} activeTab={activeTab} setActiveTab={setActiveTab} />

                        <RecordSection
                            activeTab={activeTab}
                            summaries={summaries}
                            refinedScript={refinedScript}
                            speakers={speakers}
                            recordingState={"finished"} // DetailPage에서는 항상 종료 상태
                        />

                        {/* 🔹 하단 RecordBar */}
                        <div className="sticky bottom-4 relative">
                            <RecordBar
                                onStart={() => {}}
                                onCreateTemplate={() => setShowTemplateModal(true)}
                                onTogglePanel={() => setIsPanelVisible((p) => !p)}
                                onStop={() => {}}
                                isDetailPage={true}
                            />

                            {/* 🔹 템플릿 모달 */}
                            <TemplateModal
                                isOpen={showTemplateModal}
                                onClose={() => setShowTemplateModal(false)}
                                onSelect={handleSelectTemplate}
                            />
                        </div>
                    </main>

                    {/* 🔹 오른쪽 패널 (메모 | GPT) */}
                    <AnimatePresence>
                        {isPanelVisible && (
                            <motion.aside
                                key="rightpanel"
                                initial={{ x: 400, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 400, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                                className="fixed top-0 right-0 h-full w-[360px] bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.08)] overflow-hidden z-30 rounded-l-2xl"
                            >
                                <RightPanel
                                    boardId={id}
                                    memoId={id}
                                    activeTab={activeGPTTab}
                                    onTogglePanel={() => setIsPanelVisible((p) => !p)}
                                />
                            </motion.aside>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* 🔹 Toast 알림 */}
            <AnimatePresence>
                {toast.visible && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{ duration: 0.4 }}
                        className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border border-gray-100 shadow-lg rounded-2xl px-7 py-5 z-[9999]"
                    >
                        {toast.content}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
