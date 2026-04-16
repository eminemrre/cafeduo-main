import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

interface ToastProps {
  id: string;
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="text-green-500 shrink-0" size={20} />,
  error: <AlertCircle className="text-red-500 shrink-0" size={20} />,
  loading: <Loader2 className="text-blue-500 animate-spin shrink-0" size={20} />,
  info: <Info className="text-blue-500 shrink-0" size={20} />,
};

const borderColors: Record<ToastType, string> = {
  success: 'border-green-500',
  error: 'border-red-500',
  loading: 'border-blue-500',
  info: 'border-blue-500',
};

const bgColors: Record<ToastType, string> = {
  success: 'bg-green-500/5',
  error: 'bg-red-500/5',
  loading: 'bg-blue-500/5',
  info: 'bg-blue-500/5',
};

export const Toast: React.FC<ToastProps> = ({ id, message, type = 'info', onClose, duration = 5000 }) => {
  useEffect(() => {
    if (type === 'loading') return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose, type]);

  return (
    <motion.div
      data-toast-id={id}
      layout
      initial={{ x: 100, opacity: 0, scale: 0.8 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 100, opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`rf-screen-card-muted flex items-center gap-3 ${bgColors[type]} border-l-4 ${borderColors[type]} text-white px-4 py-3 shadow-2xl min-w-[300px] max-w-[400px] rounded-lg`}
    >
      {iconMap[type]}
      <p className="font-medium text-sm flex-1">{message}</p>
      <button
        onClick={onClose}
        aria-label="Bildirimi kapat"
        className="text-[var(--rf-muted)] hover:text-white p-1 border border-transparent hover:border-cyan-500/35 hover:bg-cyan-900/20 rounded transition-colors"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

export default Toast;
