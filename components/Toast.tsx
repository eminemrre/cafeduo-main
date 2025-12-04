import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type?: ToastType;
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose, duration = 5000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle className="text-green-500" />;
            case 'error': return <AlertCircle className="text-red-500" />;
            default: return <Info className="text-blue-500" />;
        }
    };

    const getBorderColor = () => {
        switch (type) {
            case 'success': return 'border-green-500';
            case 'error': return 'border-red-500';
            default: return 'border-blue-500';
        }
    };

    return (
        <div className={`fixed top-24 right-4 z-50 flex items-center gap-3 bg-[#1a1f2e] border-l-4 ${getBorderColor()} text-white px-6 py-4 rounded shadow-2xl animate-slide-in`}>
            {getIcon()}
            <p className="font-medium">{message}</p>
            <button onClick={onClose} className="ml-4 text-gray-400 hover:text-white">
                <X size={18} />
            </button>
        </div>
    );
};
