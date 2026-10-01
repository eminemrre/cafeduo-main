/**
 * RetroButton — Riso Kantin press-button primitive.
 *
 * Four variants in the Riso Kantin palette: each is a flat, ink-bordered
 * paper sticker with a 6px hard-shadow offset. Click presses the sticker
 * down (translate + drop shadow) like an old print-shop stamp.
 *
 * Variants:
 *   - primary: bg-riso-pink (signature CTA color)
 *   - secondary: bg-paper (neutral, less emphasis)
 *   - danger: bg-riso-redox (destructive actions)
 *   - ghost: transparent, ink-text only (tertiary)
 */

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
    lg: 'min-h-[56px] px-8 py-3.5 text-base md:text-lg',
  };

  const baseStyles =
    'duo-button font-riso-body font-semibold tracking-normal select-none touch-manipulation ' +
    'border-2 border-carbon relative transition-all duration-150 ease-out ' +
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-paper focus:ring-carbon';

  const variants: Record<NonNullable<RetroButtonProps['variant']>, string> = {
    primary:
      'bg-riso-pink text-carbon riso-shadow-md ' +
      'hover:-translate-y-[1px] hover:shadow-[5px_5px_0_0_rgba(20,20,19,1)] ' +
      'active:translate-y-[1px] active:translate-x-[1px] active:shadow-[2px_2px_0_0_rgba(20,20,19,1)]',
    secondary:
      'bg-paper text-carbon riso-shadow-sm ' +
      'hover:-translate-y-[1px] hover:bg-paper-deep hover:shadow-[5px_5px_0_0_rgba(20,20,19,1)] ' +
      'active:translate-y-[1px] active:translate-x-[1px] active:shadow-[2px_2px_0_0_rgba(20,20,19,1)]',
    danger:
      'bg-riso-redox text-paper riso-shadow-md ' +
      'hover:-translate-y-[1px] hover:shadow-[5px_5px_0_0_rgba(20,20,19,1)] ' +
      'active:translate-y-[1px] active:translate-x-[1px] active:shadow-[2px_2px_0_0_rgba(20,20,19,1)]',
    ghost:
      'bg-transparent text-carbon ' +
      'hover:bg-paper-deep hover:-translate-y-[1px] ' +
      'active:translate-y-[1px]',
  };

  const disabledStyles = disabled
    ? 'opacity-40 cursor-not-allowed grayscale-[40%] hover:translate-y-0 hover:translate-x-0'
    : 'cursor-pointer';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...rest}
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${disabledStyles} ${className}`.replace(
        /\s+/g,
        ' '
      )}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <span className="relative flex items-center justify-center gap-2">
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </span>
    </motion.button>
  );
};

export default RetroButton;
