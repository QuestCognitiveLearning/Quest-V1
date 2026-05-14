import React from "react";
import { AlertCircle, CheckCircle, Info, XCircle, X } from "lucide-react";

export default function NotificationModal({ isOpen, onClose, type = "info", title, message }) {
  if (!isOpen) return null;

  const styles = {
    success: {
      bg: "bg-green-100",
      icon: <CheckCircle className="w-6 h-6 text-green-600" />,
      titleColor: "text-green-900"
    },
    error: {
      bg: "bg-red-100",
      icon: <XCircle className="w-6 h-6 text-red-600" />,
      titleColor: "text-red-900"
    },
    warning: {
      bg: "bg-orange-100",
      icon: <AlertCircle className="w-6 h-6 text-orange-600" />,
      titleColor: "text-orange-900"
    },
    info: {
      bg: "bg-blue-100",
      icon: <Info className="w-6 h-6 text-blue-600" />,
      titleColor: "text-blue-900"
    }
  };

  const style = styles[type] || styles.info;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-12 h-12 ${style.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
            {style.icon}
          </div>
          <div className="flex-1">
            <h3 className={`text-xl font-bold ${style.titleColor} mb-2`}>{title}</h3>
            <p className="text-gray-700 whitespace-pre-line">{message}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <button 
          onClick={onClose} 
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}