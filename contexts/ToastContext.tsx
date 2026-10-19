/**
 * ToastContext
 *
 * @description Global toast/notification sistemi
 * @usage const { toast } = useToast();
 *         toast.success('Başarılı!');
 *         toast.error('Hata oluştu');
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

// Toast icons: the state colours of DESIGN.md at their text depth (AA on paper).
const ToastIcon = ({ type }: { type: ToastType }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 shrink-0 text-[#177A41]" aria-hidden="true" />;
    case 'error':
      return <XCircle className="w-5 h-5 shrink-0 text-[#B8241A]" aria-hidden="true" />;
    case 'warning':
      return <AlertCircle className="w-5 h-5 shrink-0 text-[#8A6608]" aria-hidden="true" />;
    case 'loading':
      return <Loader2 className="w-5 h-5 shrink-0 text-carbon animate-spin" aria-hidden="true" />;
    default:
      return null;
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Declared before addToast so the closure captures the stable callback reference
  // and the auto-dismiss setTimeout can call it without an exhaustive-deps warning.
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType, duration: number = 3000) => {
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
    },
    [dismissToast]
  );

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
      {/* Toast Container - Stacked with animations */}
      <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-4 z-[105] flex flex-col items-end gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              role={t.type === 'error' ? 'alert' : 'status'}
              className="duo-float pointer-events-auto flex w-full items-center gap-3 bg-paper py-3 pl-4 pr-2 text-carbon sm:w-[360px]"
            >
              <ToastIcon type={t.type} />
              <p className="flex-1 text-[0.9375rem] leading-snug">{t.message}</p>
              <button
                type="button"
                data-testid="toast-close"
                aria-label="Bildirimi kapat"
                onClick={() => dismissToast(t.id)}
                className="duo-focus inline-flex h-11 w-11 shrink-0 items-center justify-center text-carbon-soft transition-colors hover:bg-paper-deep hover:text-carbon"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
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
