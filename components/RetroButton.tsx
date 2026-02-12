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
    font-pixel tracking-wide transition-all relative group rounded-2xl
    select-none touch-manipulation
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#050a19]
  `;

  const variants = {
    primary: `
      bg-[linear-gradient(120deg,#0e3664_0%,#16467f_58%,#2a5e96_100%)] text-cyan-50 border border-cyan-300/45
      hover:brightness-110 hover:shadow-[0_0_30px_rgba(0,217,255,0.24)]
      focus:ring-cyan-300/55
    `,
    secondary: `
      bg-[linear-gradient(120deg,rgba(9,21,44,0.94),rgba(17,39,74,0.84))] text-cyan-100 border border-cyan-400/32
      hover:bg-[linear-gradient(120deg,rgba(12,27,56,0.95),rgba(21,47,88,0.88))] hover:shadow-[0_0_22px_rgba(0,217,255,0.17)]
      focus:ring-cyan-300/45
    `,
    danger: `
      bg-[#440e24] text-pink-100 border border-pink-400/45
      hover:bg-[#5b1530] hover:shadow-[0_0_24px_rgba(255,77,141,0.36)]
      focus:ring-pink-300/55
    `,
    ghost: `
      bg-transparent text-[#9eb4d3] border border-cyan-500/28
      hover:text-cyan-100 hover:border-cyan-300/50 hover:bg-cyan-900/20
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
        y: -1,
        scale: 1.01
      }}
      transition={{ 
        type: 'spring', 
        stiffness: 400, 
        damping: 25 
      }}
    >
      {/* Shine effect overlay */}
      <span className="absolute inset-0 bg-gradient-to-b from-cyan-200/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      {/* Content */}
      <span className="relative flex items-center justify-center gap-2">
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </span>
    </motion.button>
  );
};

export default RetroButton;
