import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import apiClient from "../api/apiClient";
import { useToast } from "../hooks/useToast";
import RecordHeader from "../components/recording/RecordHeader";
import RecordTabs from "../components/recording/RecordTabs";
import RecordSection from "../components/recording/RecordSection";
import RightPanel from "../components/recording/RightPanel";
import RecordBar from "../components/recording/RecordBar";
import TemplateModal from "../components/recording/TemplateModal"; // 필요시
import { motion, AnimatePresence } from "framer-motion";
import FinalSummarySection from "@/components/recording/FinalSummarySection.jsx";

export default function RecordDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showToast } = useToast();

    // 🔹 기존 상태
    const [board, setBoard] = useState(null);
    const [memo, setMemo] = useState(null);
    const [noSession, setNoSession] = useState(false);
    const [title, setTitle] = useState("");
    const [dateStr, setDateStr] = useState("");
    const [summaries, setSummaries] = useState([]);
    const [refinedScript, setRefinedScript] = useState([]);
    const [speakers, setSpeakers] = useState([]);
    const [activeTab, setActiveTab] = useState("record");
    const [isPanelVisible, setIsPanelVisible] = useState(false);
    const [activeGPTTab, setActiveGPTTab] = useState("memo");
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const { folders } = useSelector((state) => state.folder);
    const [showDropdown, setShowDropdown] = useState(false);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [sharedUsers, setSharedUsers] = useState([]);
    const [userRole, setUserRole] = useState("owner"); // 기본값은 owner
    const user = JSON.parse(localStorage.getItem("user")); // 로그인한 유저 정보 (email, id 등)
    const [recordingResults, setRecordingResults] = useState([]);
    const [finalSummaries, setFinalSummaries] = useState([]);



    // 🔹 추가된 상태: 보호 회의 접근 제어용
    const [isLocked, setIsLocked] = useState(false);   // 보호 여부
    const [pin, setPin] = useState("");                // 입력된 비밀번호
    const [isVerified, setIsVerified] = useState(false); // 검증 성공 여부

    // 🔹 회의 불러오기 (보호 여부 포함)
    const fetchBoard = async () => {
        try {
            const res = await apiClient.get(`/boards/${id}/full`);
            const data = res.data;
            console.log("📦 /boards/full 응답:", res.data);

            setBoard(data.board);
            setTitle(data.board.title);
            setDateStr(new Date(data.board.created_at).toLocaleString("ko-KR"));
            setMemo(data.memo);
            setRecordingResults(data.recording_results || []);
            setSummaries(data.summaries || []);
            setRefinedScript(data.recording_results || []);
            setFinalSummaries(data.final_summaries || []);

            // ✅ 1분 요약 (summaries)
            const summariesData = (data.summaries || []).map((s) => ({
                paragraph: s.content || "",
                summary: s.content || "",
            }));
            setSummaries(summariesData);

            // ✅ 스크립트 변환 (recording_results)
            const scriptData = (data.recording_results || []).map((r) => ({
                start_time: r.started_at,
                end_time: r.ended_at,
                text: r.raw_text,
                speaker_label: r.speaker_label,
            }));
            setRefinedScript(scriptData);

            // ✅ 화자 목록
            const speakersList = [
                ...new Set((data.recording_results || []).map((r) => r.speaker_label)),
            ].filter(Boolean);
            setSpeakers(speakersList);

            // 🔹 보호 여부 감지 (URL 쿼리 + 서버 응답 둘 다 확인)
            const protectedQuery = searchParams.get("protected") === "true";
            if (data.is_protected || protectedQuery) {
                setIsLocked(true);
            }
            // 🍒공유멤버
            const shareRes = await apiClient.get(`/boards/${id}/shares/members`);
            const normalized = (shareRes.data || []).map(u => ({
                user_id: u.user_id,
                user_name: u.nickname || u.user_name,
                user_email: u.email || u.user_email,
                user_picture: u.picture || u.user_picture,
                role: u.role,
            }));
            setSharedUsers(normalized);

            // 공유멤버 조회 후 role 결정
            if (shareRes.data && user) {
                const myShare = shareRes.data.find(u => u.user_id === user.id);
                if (myShare) setUserRole(myShare.role); // viewer/editor
                else if (data.board.owner_id === user.id) setUserRole("owner");
            }
        } catch (err) {
            const status = err.response?.status;
            const protectedQuery = searchParams.get("protected") === "true";

            // 🔹 게스트 접근 중 보호된 회의라면 PIN 입력창 표시
                if ((status === 403 || status === 404) && protectedQuery) {
                    console.warn("🔹 보호된 회의 접근 시 PIN 인증 필요");
                    setIsLocked(true);
                    setBoard({ id }); // 최소 데이터 세팅
                    return;
                }
            // 소유자가 아니면 403 에러 발생 → 무시
            if (err.response?.status !== 403) {
                console.warn("공유 멤버 조회 실패:", err);
            }
            if (status === 404) {
                    console.warn("🔹 존재하지 않거나 접근 불가한 보드 → 빈 회의로 처리");
                    setBoard({ id, title: "새 회의", created_at: new Date().toISOString() });
                    setTitle("새 회의");
                    setDateStr(
                            new Date().toLocaleString("ko-KR", {
                                    month: "2-digit",
                                day: "2-digit",
                                weekday: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                            })
                    );
                    setNoSession(true);
                } else {
                    console.error("🔹 회의 불러오기 실패:", err);
                }
        }
    };
    // 🔹 폴더목록 불러오기
    const handleSelectFolder = async (folder) => {
        if (!folder || !board?.id) return;
        try {
            await apiClient.patch(`/boards/${board.id}/move`, { folder_id: folder.id });
            setShowDropdown(false);
            setCurrentFolder(folder);
            showToast(`📂 "${folder.name}" 폴더로 이동했습니다.`);
        } catch (err) {
            console.error("폴더 이동 실패:", err);
            showToast("폴더 이동 중 오류가 발생했습니다.");
        }
    };


    // 🔹 녹음 결과 불러오기 (기존 유지)
    // const fetchRecordingResults = async () => {
    //     try {
    //         const res = await apiClient.get(`/recording/result/${id}`);
    //         const data = res.data;
    //         const results = data.items || [];
    //
    //         if (!results.length) {
    //             console.log("🔹 녹음 결과 없음 (session 미생성)");
    //             setNoSession(true);
    //             return;
    //         }
    //
    //         const summariesData = results
    //             .filter((r) => r.summary)
    //             .map((r) => ({ paragraph: r.paragraph, summary: r.summary }));
    //
    //         const scriptData = results.map((r) => ({
    //             start_time: r.start_time,
    //             end_time: r.end_time,
    //             text: r.text,
    //             speaker_label: r.speaker_label,
    //         }));
    //
    //         setSummaries(summariesData);
    //         setRefinedScript(scriptData);
    //         setSpeakers([...new Set(results.map((r) => r.speaker_label))].filter(Boolean));
    //     } catch (err) {
    //         if (err.response?.status === 404) {
    //             console.warn("🔹 녹음 결과 없음 → 빈 회의로 처리");
    //             setNoSession(true);
    //         } else {
    //             console.error("🔹 녹음 결과 불러오기 실패:", err);
    //         }
    //     }
    // };


    // 🔹 비밀번호 검증 요청
    const handleVerifyPin = async () => {
        try {
            const res = await apiClient.post(`/boards/${id}/verify-password`, {
                password: pin, // ✅ 백엔드 스키마 맞춤
            });
            if (res.status === 200) {
                setIsVerified(true);
                showToast("🔓 접근 허용되었습니다.");
            }
        } catch (err) {
            showToast("❌ 비밀번호가 일치하지 않습니다.");
        }
    };

    // 🔹 초기 로드
    useEffect(() => {
        fetchBoard();
        // fetchRecordingResults();
    }, [id]);

    // 🔹 보호 중이며 아직 인증 안 된 경우 → 비밀번호 입력창 표시
    if (isLocked && !isVerified) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <div className="bg-white shadow-lg rounded-2xl p-8 w-[320px] text-center">
                    <h2 className="text-lg font-semibold mb-3">🔒 비밀번호로 보호된 회의입니다</h2>
                    <p className="text-sm text-gray-500 mb-5">
                        4자리 숫자 비밀번호를 입력해주세요.
                    </p>
                    <input
                        type="password"
                        value={pin}
                        onChange={(e) =>
                            setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        placeholder="4자리 숫자"
                        className="w-full border rounded-lg px-3 py-2 text-center text-lg tracking-widest mb-4 focus:outline-[#7E37F9]"
                    />
                    <button
                        onClick={handleVerifyPin}
                        disabled={pin.length !== 4}
                        className="w-full bg-[#7E37F9] text-white rounded-lg py-2 font-medium hover:bg-[#6b2de4] disabled:bg-gray-300"
                    >
                        접근하기
                    </button>
                </div>
            </div>
        );
    }

    // 🔹 인증 완료 or 보호 안됨 → 기존 내용 렌더링
    if (!board) {
        return (
            <div className="flex items-center justify-center min-h-screen text-gray-400">
                로딩 중...
            </div>
        );
    }

    return (
        <motion.div
            className="relative overflow-hidden min-h-screen bg-gray-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
        >
            <div className="p-6">
                <button
                    onClick={() => navigate(-1)}
                    className="text-sm text-gray-400 hover:text-gray-600 mb-4"
                >
                    ← 돌아가기
                </button>

                <div className="grid grid-cols-[1fr_360px] gap-6">
                    {/* 🔹 메인 콘텐츠 */}
                    <main className="bg-white rounded-2xl p-6 shadow-sm flex flex-col h-[calc(100vh-140px)]">
                        <RecordHeader
                            title={board.title}
                            etTitle={(t) => {
                                if (userRole === "viewer") {
                                    showToast("⚠️ 수정 권한이 없습니다.");
                                    return;
                                }
                                setBoard({ ...board, title: t });
                            }}
                            setTitle={(t) => setBoard({ ...board, title: t })}
                            dateStr={new Date(board.created_at).toLocaleString("ko-KR")}
                            boardId={board.id}
                            folders={folders}
                            showDropdown={showDropdown}
                            setShowDropdown={setShowDropdown}
                            onSelectFolder={handleSelectFolder}
                            currentFolder={currentFolder}
                        />
                        {/* ✅ 공유 중인 멤버 표시 */}
                        {sharedUsers.length > 0 && (
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xs text-gray-500">공유 중:</span>
                                <div className="flex -space-x-2">
                                    {sharedUsers.slice(0, 3).map((user) => (
                                        <img
                                            key={user.user_id}
                                            src={user.user_picture || '/default-avatar.png'}
                                            alt={user.user_name}
                                            title={`${user.user_name} (${user.role})`}
                                            className="w-8 h-8 rounded-full border-2 border-white"
                                        />
                                    ))}

                                    {sharedUsers.length > 3 && (
                                        <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs">
                                            +{sharedUsers.length - 3}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <RecordTabs
                            tabs={[
                                { id: "record", label: "회의기록" },
                                { id: "script", label: "스크립트" },
                                ...(finalSummaries.length > 0
                                    ? [{ id: "final", label: "전체 요약" }]
                                    : []),
                            ]}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                        {/* 🔹 탭에 따라 다른 섹션 렌더링 */}
                        {noSession ? (
                            <div className="flex flex-col items-center justify-center flex-1 text-gray-400">
                                <p className="text-lg font-medium mb-1">🔹 녹음이 시작되지 않았습니다</p>
                                <p className="text-sm mb-4">
                                    이 회의에 대한 녹음을 시작하려면 아래 버튼을 눌러주세요.
                                </p>
                                <button
                                    onClick={() => navigate(`/new?boardId=${id}`)}
                                    className="mt-2 px-5 py-2.5 bg-[#7E37F9] text-white rounded-xl shadow hover:bg-[#6b2de4] transition-all"
                                >
                                    🎙️ 새 녹음 시작하기
                                </button>
                            </div>
                        ) : (
                            <>
                                {activeTab === "record" && (
                                    <RecordSection
                                        activeTab="record"
                                        summaries={summaries}
                                        recordingState="finished"
                                    />
                                )}

                                {activeTab === "script" && (
                                    <RecordSection
                                        activeTab="script"
                                        allHistory={refinedScript.map((s) => s.text)}
                                        recordingState="finished"
                                    />
                                )}

                                {activeTab === "final" && (
                                    <FinalSummarySection finalSummaries={finalSummaries} />
                                )}
                            </>
                        )}
                        {/*/!* 🔹 녹음 결과 없음 *!/*/}
                        {/*{noSession ? (*/}
                        {/*    <div className="flex flex-col items-center justify-center flex-1 text-gray-400">*/}
                        {/*        <p className="text-lg font-medium mb-1">*/}
                        {/*            🔹 녹음이 시작되지 않았습니다*/}
                        {/*        </p>*/}
                        {/*        <p className="text-sm mb-4">*/}
                        {/*            이 회의에 대한 녹음을 시작하려면 아래 버튼을 눌러주세요.*/}
                        {/*        </p>*/}
                        {/*        <button*/}
                        {/*            onClick={() => navigate(`/new?boardId=${id}`)}*/}
                        {/*            className="mt-2 px-5 py-2.5 bg-[#7E37F9] text-white rounded-xl shadow hover:bg-[#6b2de4] transition-all"*/}
                        {/*        >*/}
                        {/*            🎙️ 새 녹음 시작하기*/}
                        {/*        </button>*/}
                        {/*    </div>*/}
                        {/*) : (*/}
                        {/*    <RecordSection*/}
                        {/*        activeTab={activeTab}*/}
                        {/*        summaries={summaries}*/}
                        {/*        refinedScript={refinedScript}*/}
                        {/*        speakers={speakers}*/}
                        {/*        recordingState={"finished"}*/}
                        {/*    />*/}
                        {/*)}*/}
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
                                    boardId={board.id}
                                    memoId={memo?.id}
                                    activeTab={activeGPTTab}
                                    onTogglePanel={() => setIsPanelVisible((p) => !p)}
                                />
                            </motion.aside>
                        )}
                    </AnimatePresence>
                    {/* 🔹 하단 바: 템플릿 추가 | 녹음공유 | 메모 */}
                    <RecordBar
                        boardId={board?.id}
                        recordingState="stopped"
                        onCreateTemplate={() => {
                            if (userRole === "viewer") {
                                showToast("⚠️ 템플릿을 추가할 권한이 없습니다.");
                                return;
                            }
                            setShowTemplateModal(true);
                        }}
                        onTogglePanel={() => setIsPanelVisible((p) => !p)}
                        // 👇 추가되는 부분
                        boardTitle={board?.title}
                        summaries={summaries}
                        refinedScript={refinedScript}
                        memo={memo}
                    />

                    {/* 🔹 템플릿 모달 */}
                    <TemplateModal
                        isOpen={showTemplateModal}
                        onClose={() => setShowTemplateModal(false)}
                        onSelect={(type) => {
                            setShowTemplateModal(false);
                            if (type === "화자분리") setActiveTab("speaker");
                            else if (type === "전체요약") setActiveTab("summary");
                        }}
                    />
                </div>
            </div>
        </motion.div>
    );
}
