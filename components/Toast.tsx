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
  success: <CheckCircle className="text-riso-spring shrink-0" size={20} />,
  error: <AlertCircle className="text-riso-redox shrink-0" size={20} />,
  loading: <Loader2 className="text-riso-blue animate-spin shrink-0" size={20} />,
  info: <Info className="text-riso-blue shrink-0" size={20} />,
};

const borderColors: Record<ToastType, string> = {
  success: 'border-l-riso-spring',
  error: 'border-l-riso-redox',
  loading: 'border-l-riso-blue',
  info: 'border-l-riso-blue',
};

const bgColors: Record<ToastType, string> = {
  success: 'bg-riso-spring/15',
  error: 'bg-riso-redox/15',
  loading: 'bg-riso-blue/15',
  info: 'bg-riso-blue/15',
};

export const Toast: React.FC<ToastProps> = ({
  id,
  message,
  type = 'info',
  onClose,
  duration = 5000,
}) => {
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
      className={`border-2 border-carbon ${bgColors[type]} flex items-center gap-3 border-l-[6px] ${borderColors[type]} text-carbon px-4 py-3 riso-shadow-md min-w-[300px] max-w-[400px]`}
    >
      {iconMap[type]}
      <p className="font-medium text-sm flex-1 font-riso-body">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Bildirimi kapat"
        className="text-carbon-muted hover:text-carbon p-1 border-2 border-transparent hover:border-carbon hover:bg-paper transition-colors"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

export default Toast;
