import React from 'react';
import { HTMLMotionProps, motion } from 'framer-motion';

interface RetroButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const RetroButton: React.FC<RetroButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  type = 'button', 
  disabled = false,
  size = 'md',
  icon,
  ...rest
}) => {
  // Touch-friendly minimum sizes (44x44px for accessibility)
  const sizeStyles = {
    sm: 'min-h-[40px] px-4 py-2 text-sm',
    md: 'min-h-[48px] px-6 py-3 text-sm md:text-base',
    lg: 'min-h-[56px] px-8 py-3.5 text-base md:text-lg'
  };

  const baseStyles = `
    font-pixel tracking-[0.12em] transition-all relative group rounded-none
    select-none touch-manipulation
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#050a19]
    uppercase
    border-2
  `;

  const variants = {
    primary: `
      bg-[#00f3ff] text-[#041226] border-cyan-300
      shadow-[6px_6px_0_rgba(255,0,234,0.35)]
      hover:bg-[#17f8ff] hover:translate-x-[-1px] hover:translate-y-[-1px]
      hover:shadow-[8px_8px_0_rgba(255,0,234,0.4)]
      focus:ring-cyan-300/55
    `,
    secondary: `
      bg-[linear-gradient(160deg,rgba(5,12,28,0.96),rgba(3,7,18,0.94))] text-cyan-100 border-cyan-400/42
      shadow-[6px_6px_0_rgba(0,243,255,0.22)]
      hover:border-cyan-300/72 hover:translate-x-[-1px] hover:translate-y-[-1px]
      hover:shadow-[8px_8px_0_rgba(0,243,255,0.28)]
      focus:ring-cyan-300/45
    `,
    danger: `
      bg-[linear-gradient(160deg,rgba(55,10,36,0.96),rgba(31,7,20,0.94))] text-pink-100 border-pink-400/48
      shadow-[6px_6px_0_rgba(255,0,234,0.3)]
      hover:border-pink-300/76 hover:translate-x-[-1px] hover:translate-y-[-1px]
      hover:shadow-[8px_8px_0_rgba(255,0,234,0.34)]
      focus:ring-pink-300/55
    `,
    ghost: `
      bg-black/20 text-[#9eb4d3] border-cyan-500/35
      hover:text-cyan-100 hover:border-cyan-300/62 hover:bg-cyan-900/18
      hover:translate-x-[-1px] hover:translate-y-[-1px]
      hover:shadow-[6px_6px_0_rgba(0,243,255,0.2)]
      focus:ring-cyan-200/40
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
      {...rest}
      className={`
        ${baseStyles} 
        ${sizeStyles[size]} 
        ${variants[variant]} 
        ${disabledStyles} 
        ${className}
      `}
      whileTap={disabled ? {} : { 
        scale: 0.97,
        y: 1
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
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <span className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-100/70 to-transparent pointer-events-none" />
      
      {/* Content */}
      <span className="relative flex items-center justify-center gap-2">
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </span>
    </motion.button>
  );
};

export default RetroButton;
