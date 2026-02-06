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
    md: 'min-h-[48px] px-6 py-3 text-sm md:text-base',
    lg: 'min-h-[56px] px-8 py-3.5 text-base md:text-lg'
  };

  const baseStyles = `
    font-pixel uppercase tracking-wide transition-all relative group rounded-2xl
    select-none touch-manipulation
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#f6efe6]
  `;

  const variants = {
    primary: `
      bg-gradient-to-r from-[#1f6f78] to-[#be7b43] text-white border border-transparent
      hover:brightness-105 hover:shadow-[0_14px_28px_rgba(31,111,120,0.28)]
      focus:ring-[#1f6f78]/50
    `,
    secondary: `
      bg-white/75 text-[#27333f] border border-[#d2b89f]
      hover:bg-white hover:shadow-[0_10px_22px_rgba(50,37,25,0.12)]
      focus:ring-[#be7b43]/40
    `,
    danger: `
      bg-[#8d3a2d] text-white border border-[#7c3328]
      hover:bg-[#a34231] hover:shadow-[0_12px_24px_rgba(141,58,45,0.34)]
      focus:ring-red-500/50
    `,
    ghost: `
      bg-transparent text-[#4f5d6b] border border-[#c9b29b]
      hover:text-[#1f2328] hover:border-[#b99a7f] hover:bg-white/60
      focus:ring-[#8d725b]/40
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
        scale: 0.97
      }}
      whileHover={disabled ? {} : {
        y: -1
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
