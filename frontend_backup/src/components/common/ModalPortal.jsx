// src/components/common/ModalPortal.tsx
import { createPortal } from "react-dom";
import { ReactNode, useEffect, useRef, useState } from "react";

export default function ModalPortal({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLElement | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        ref.current = document.body;
        setMounted(true);
        return () => setMounted(false);
    }, []);
    return mounted && ref.current ? createPortal(children, ref.current) : null;
}
