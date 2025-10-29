export const LandingFooter = () => {
    return (
        <footer className="w-full bg-[#F8F6FB] border-t border-[#E0D7F7] py-12 text-gray-700">
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 px-6">

                {/* ✅ 1. 로고 & 간단 소개 */}
                <div>
                    <img src="/assets/NoteRi-Logo.svg" alt="NoteRi Logo" className="h-6 mb-3" />
                    <p className="text-sm text-gray-500">
                        AI가 회의를 자동으로 기록하고 요약하는 <br /> 스마트 워크 도우미 NoteRi
                    </p>
                </div>

                {/* ✅ 2. 빠른 링크 */}
                <div>
                    <h3 className="font-semibold text-gray-800 mb-3">서비스</h3>
                    <ul className="space-y-2 text-sm">
                        <li><a href="#features" className="hover:text-[#7E37F9]">기능 소개</a></li>
                        <li><a href="#pricing" className="hover:text-[#7E37F9]">요금제</a></li>
                        <li><a href="#faq" className="hover:text-[#7E37F9]">FAQ</a></li>
                    </ul>
                </div>

                {/* ✅ 3. 팀 / 프로젝트 */}
                <div>
                    <h3 className="font-semibold text-gray-800 mb-3">Team NoteRi</h3>
                    <ul className="space-y-2 text-sm">
                        <li>Frontend — Park JiYe</li>
                        <li>Backend — Kim HyeomJae</li>
                        <li>AI/Infra — Park BeomCheol</li>
                        <li>
                            <a href="https://github.com/NoteRi-project" target="_blank" className="text-[#7E37F9] hover:underline">
                                GitHub Repository →
                            </a>
                        </li>
                    </ul>
                </div>

                {/* ✅ 4. Contact */}
                <div>
                    <h3 className="font-semibold text-gray-800 mb-3">Contact</h3>
                    <p className="text-sm text-gray-500">문의: noteriproject@gmail.com</p>
                    <p className="text-sm text-gray-500">Notion: team.noteri.io</p>
                </div>
            </div>

            {/* ✅ 하단 저작권 */}
            <div className="text-center text-xs text-gray-400 mt-12">
                © 2025 NoteRi Project. All rights reserved.
            </div>
        </footer>

    )
}
