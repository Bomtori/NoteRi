import { useState } from "react";

export function useToast() {
  const [toast, setToast] = useState({ visible: false, content: null });

  const showToast = (content, duration = 0) => {
    setToast({ visible: true, content });
    if (duration > 0) {
      setTimeout(() => setToast({ visible: false, content: null }), duration);
    }
  };

  const clearToast = () => setToast({ visible: false, content: null });

  return { toast, showToast, clearToast };
}
