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

export const Toast: React.FC<ToastProps> = ({ 
  id,
  message, 
  type = 'info', 
  onClose, 
  duration = 5000 
}) => {
  useEffect(() => {
    if (type === 'loading') return; // Loading toast'u otomatik kapanmaz
    
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose, type]);

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle className="text-green-500" size={20} />;
      case 'error': return <AlertCircle className="text-red-500" size={20} />;
      case 'loading': return <Loader2 className="text-blue-500 animate-spin" size={20} />;
      default: return <Info className="text-blue-500" size={20} />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success': return 'border-green-500';
      case 'error': return 'border-red-500';
      case 'loading': return 'border-blue-500';
      default: return 'border-blue-500';
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success': return 'bg-green-500/5';
      case 'error': return 'bg-red-500/5';
      case 'loading': return 'bg-blue-500/5';
      default: return 'bg-blue-500/5';
    }
  };

  return (
    <motion.div
      data-toast-id={id}
      layout
      initial={{ x: 100, opacity: 0, scale: 0.8 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 100, opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`rf-screen-card-muted noise-bg flex items-center gap-3 ${getBgColor()} border-l-4 ${getBorderColor()} text-white px-4 py-3 shadow-2xl min-w-[300px] max-w-[400px]`}
    >
      {getIcon()}
      <p className="font-medium text-sm flex-1">{message}</p>
      <motion.button 
        onClick={onClose} 
        className="text-[var(--rf-muted)] hover:text-white p-1 border border-transparent hover:border-cyan-500/35 hover:bg-cyan-900/20 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <X size={16} />
      </motion.button>
    </motion.div>
  );
};

export default Toast;
