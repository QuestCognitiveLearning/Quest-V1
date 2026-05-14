import { useState } from "react";

export function useNotification() {
  const [notification, setNotification] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: ""
  });

  const showNotification = (type, title, message) => {
    setNotification({
      isOpen: true,
      type,
      title,
      message
    });
  };

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  };

  return {
    notification,
    showNotification,
    closeNotification,
    showSuccess: (title, message) => showNotification("success", title, message),
    showError: (title, message) => showNotification("error", title, message),
    showWarning: (title, message) => showNotification("warning", title, message),
    showInfo: (title, message) => showNotification("info", title, message)
  };
}