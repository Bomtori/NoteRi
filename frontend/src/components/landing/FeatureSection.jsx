export default function FeatureSection() {
    return (
        <section className="py-24 bg-gray-50 text-center">
            <h2 className="text-3xl font-semibold text-[#272527] mb-8">
                NoteRi 주요 기능
            </h2>
            <div className="flex justify-center gap-10">
                <div className="w-60 p-6 bg-white rounded-2xl shadow-sm">
                    <h3 className="font-bold text-[#7E37F9] mb-2">실시간 녹음</h3>
                    <p className="text-gray-600 text-sm">
                        클릭 한 번으로 회의를 자동 기록합니다.
                    </p>
                </div>
                <div className="w-60 p-6 bg-white rounded-2xl shadow-sm">
                    <h3 className="font-bold text-[#7E37F9] mb-2">AI 요약</h3>
                    <p className="text-gray-600 text-sm">
                        길고 복잡한 회의 내용을 자동으로 요약해드립니다.
                    </p>
                </div>
                <div className="w-60 p-6 bg-white rounded-2xl shadow-sm">
                    <h3 className="font-bold text-[#7E37F9] mb-2">폴더 관리</h3>
                    <p className="text-gray-600 text-sm">
                        회의록을 주제별로 정리하고 관리하세요.
                    </p>
                </div>
            </div>
        </section>
    );
}
