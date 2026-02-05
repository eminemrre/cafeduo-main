import React from 'react';
import { motion } from 'framer-motion';

interface RetroButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const RetroButton: React.FC<RetroButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  type = 'button', 
  disabled = false,
  size = 'md',
  icon
}) => {
  // Touch-friendly minimum sizes (44x44px for accessibility)
  const sizeStyles = {
    sm: 'min-h-[40px] px-4 py-2 text-sm',
    md: 'min-h-[48px] px-6 md:px-8 py-3 text-base md:text-lg',
    lg: 'min-h-[56px] px-8 md:px-10 py-4 text-lg md:text-xl'
  };

  const baseStyles = `
    font-pixel uppercase transition-all relative group
    select-none touch-manipulation
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0f141a]
  `;

  const variants = {
    primary: `
      bg-gray-200 text-black border-2 border-white border-b-gray-600 border-r-gray-600
      hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]
      active:border-b-white active:border-r-white active:border-t-gray-600 active:border-l-gray-600
      focus:ring-white/50
    `,
    secondary: `
      bg-slate-700 text-white border-2 border-slate-500 border-b-slate-900 border-r-slate-900
      hover:bg-slate-600 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]
      active:border-b-slate-500 active:border-r-slate-500 active:border-t-slate-900 active:border-l-slate-900
      focus:ring-blue-500/50
    `,
    danger: `
      bg-red-600 text-white border-2 border-red-400 border-b-red-900 border-r-red-900
      hover:bg-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]
      active:border-b-red-400 active:border-r-red-400 active:border-t-red-900 active:border-l-red-900
      focus:ring-red-500/50
    `,
    ghost: `
      bg-transparent text-gray-300 border-2 border-gray-700
      hover:text-white hover:border-gray-500 hover:bg-white/5
      active:bg-white/10
      focus:ring-gray-500/50
    `
  };

  const disabledStyles = disabled 
    ? 'opacity-50 cursor-not-allowed grayscale' 
    : 'cursor-pointer';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseStyles} 
        ${sizeStyles[size]} 
        ${variants[variant]} 
        ${disabledStyles} 
        ${className}
      `}
      whileTap={disabled ? {} : { 
        scale: 0.96,
        y: 2
      }}
      whileHover={disabled ? {} : {
        scale: 1.02
      }}
      transition={{ 
        type: 'spring', 
        stiffness: 400, 
        damping: 25 
      }}
    >
      {/* Shine effect overlay */}
      <span className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      {/* Content */}
      <span className="relative flex items-center justify-center gap-2">
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </span>
    </motion.button>
  );
};

export default RetroButton;
