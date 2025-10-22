export default function HeroSection({ onStart }) {
    return (
        <section className="flex flex-col items-center justify-center text-center py-32 bg-gradient-to-b from-[#E9E6EA] to-white">
            <h1 className="text-5xl font-bold text-[#7E37F9] mb-6">
                회의는 녹음하세요,<br />정리는 AI가 합니다.
            </h1>
            <p className="text-gray-600 text-lg mb-10">
                음성 기록부터 요약까지 한 번에, NoteRi가 대신해드립니다.
            </p>
            <button
                onClick={onStart}
                className="bg-[#7E37F9] text-white px-8 py-3 rounded-full text-lg shadow-md hover:bg-[#6c2fe3] transition"
            >
                시작하기
            </button>
        </section>
    );
}
