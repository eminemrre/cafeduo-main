/**
 * ToastContext
 * 
 * @description Global toast/notification sistemi
 * @usage const { toast } = useToast();
 *         toast.success('Başarılı!');
 *         toast.error('Hata oluştu');
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'loading';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    loading: (message: string, duration?: number) => void;
    dismiss: (id: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast ikonları
const ToastIcon = ({ type }: { type: ToastType }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'warning':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    case 'loading':
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    default:
      return null;
  }
};

// Toast renkleri
const ToastStyles = {
  success: 'border-l-4 border-green-500 bg-gray-900',
  error: 'border-l-4 border-red-500 bg-gray-900',
  warning: 'border-l-4 border-yellow-500 bg-gray-900',
  loading: 'border-l-4 border-blue-500 bg-gray-900',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType, duration: number = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, newToast]);

    // Loading toast'u otomatik kapatma
    if (type !== 'loading' && duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }

    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (message: string, duration = 3000) => addToast(message, 'success', duration),
    error: (message: string, duration = 4000) => addToast(message, 'error', duration),
    warning: (message: string, duration = 3000) => addToast(message, 'warning', duration),
    loading: (message: string, duration = 0) => addToast(message, 'loading', duration),
    dismiss: dismissToast,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${ToastStyles[t.type]} rounded-lg shadow-lg p-4 flex items-center gap-3 animate-in slide-in-from-right duration-300`}
          >
            <ToastIcon type={t.type} />
            <p className="text-white text-sm flex-1">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Hook
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context.toast;
};

export default ToastContext;
