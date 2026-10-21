/**
 * RetroButton — the shared press button in the v2 language (DESIGN.md).
 *
 * Flat rectangles with real edges: no border, no shadow. Hover lifts the
 * button 2 px, a press scales it to 0.98. Ink text on candy, paper text on
 * ink and danger.
 *
 * Variants:
 *   - primary: lokum fill (the one primary action of an area)
 *   - ink: ink fill, paper text (the primary next to a lokum field)
 *   - secondary: ice fill (a neutral second action)
 *   - danger: danger fill (destructive actions)
 *   - ghost: no box, an ink underline on hover (tertiary)
 */

import React from 'react';
import { HTMLMotionProps, motion } from 'framer-motion';

interface RetroButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'ink' | 'secondary' | 'danger' | 'ghost';
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
    sm: 'min-h-[44px] px-4 py-2 text-sm',
    md: 'min-h-[48px] px-6 py-3 text-sm md:text-base',
    lg: 'min-h-[56px] px-8 py-3.5 text-base md:text-lg',
  };

  const baseStyles =
    'duo-button font-candy-body font-semibold tracking-normal select-none touch-manipulation ' +
    'relative transition-[transform,background-color,text-decoration-color] duration-150 ease-out duo-focus';

  const variants: Record<NonNullable<RetroButtonProps['variant']>, string> = {
    primary: 'bg-candy-lokum text-carbon hover:-translate-y-0.5',
    ink: 'bg-carbon text-paper hover:-translate-y-0.5',
    secondary: 'bg-paper-deep text-carbon hover:-translate-y-0.5 hover:bg-paper-dim',
    danger: 'bg-candy-danger text-paper hover:-translate-y-0.5',
    ghost:
      'bg-transparent text-carbon underline decoration-transparent decoration-[3px] underline-offset-[6px] hover:decoration-carbon',
  };

  const disabledStyles = disabled
    ? 'opacity-45 cursor-not-allowed hover:translate-y-0'
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
