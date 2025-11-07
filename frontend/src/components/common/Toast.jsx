
import { useEffect } from "react";

export default function Toast({ message, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 2000);
        return () => clearTimeout(timer);
    }, [onClose]);

    if (!message) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <div
                className="px-5 py-2.5 text-sm font-semibold text-[#7E37F9]
                           rounded-full border border-[#7E37F9]
                           bg-[#fff]/10 shadow-[0_4px_16px_rgba(126,55,249,0.2)]
                           backdrop-blur-sm animate-fadeInSmooth"
            >
                {message}
            </div>
        </div>
    );
}
