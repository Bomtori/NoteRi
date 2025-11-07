import { useState } from "react";

export function useToast() {
  const [toast, setToast] = useState({ visible: false, content: null });

  const showToast = (content, duration = 2000) => {
     setToast({ visible: true, content });

    if (duration > 0) {
      // duration 뒤에 자동으로 닫힘
      setTimeout(() => {
        setToast({ visible: false, content: null });
      }, duration);
    }
  };

  const clearToast = () => setToast({ visible: false, content: null });

  return { toast, showToast, clearToast };
}
