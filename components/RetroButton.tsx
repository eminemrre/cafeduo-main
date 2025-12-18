import React from 'react';

interface RetroButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export const RetroButton: React.FC<RetroButtonProps> = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false }) => {
  const baseStyles = "px-6 md:px-8 py-3 font-pixel text-lg md:text-xl uppercase transition-all transform active:translate-y-1 active:scale-95 border-2 relative group";

  const variants = {
    primary: "bg-gray-200 text-black border-white border-b-gray-600 border-r-gray-600 hover:bg-white hover:shadow-[0_0_15px_rgba(255,255,255,0.5)]",
    secondary: "bg-slate-700 text-white border-slate-500 border-b-slate-900 border-r-slate-900 hover:bg-slate-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};