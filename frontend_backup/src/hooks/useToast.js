import { useState } from "react";

export function useToast() {
    const [message, setMessage] = useState("");

    const showToast = (msg) => {
        setMessage(msg);
    };

    const clearToast = () => {
        setMessage("");
    };

    return { message, showToast, clearToast };
}
