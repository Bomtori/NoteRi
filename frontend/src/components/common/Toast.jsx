import { useEffect } from "react";

export default function Toast({ message, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 2000);
        return () => clearTimeout(timer);
    }, [onClose]);

    if (!message) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-red-500 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-md animate-fadeInSmooth">
                {message}
            </div>
        </div>
    );
}
