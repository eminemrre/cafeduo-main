/**
 * Admin Button — the v2 language (DESIGN.md), API unchanged.
 *
 * Flat rectangles, no border or shadow; hover lifts 2 px, press scales 0.98.
 *   - primary   → lokum fill, ink text (the one primary action of an area)
 *   - secondary → ice fill, ink text
 *   - ghost     → no box, ink underline on hover
 *   - danger    → danger-text on ice; danger fill on hover
 */
import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<Variant, string> = {
  primary: 'bg-riso-pink text-carbon hover:-translate-y-0.5',
  secondary: 'bg-paper-deep text-carbon hover:bg-paper-dim',
  ghost:
    'bg-transparent text-carbon underline decoration-transparent decoration-[3px] underline-offset-[6px] hover:decoration-carbon',
  danger: 'bg-paper-deep text-riso-redox hover:bg-riso-redox hover:text-paper',
};

const sizeClass: Record<Size, string> = {
  sm: 'min-h-11 px-3 text-[0.875rem] gap-1.5',
  md: 'min-h-12 px-4 text-[0.9375rem] gap-2',
  lg: 'min-h-14 px-6 text-[1rem] gap-2.5',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  className = '',
  children,
  ...rest
}) => (
  <button
    {...rest}
    className={
      'duo-button inline-flex items-center justify-center font-riso-body font-semibold ' +
      'transition-[transform,background-color,color,text-decoration-color] duration-150 ' +
      'riso-focus active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ' +
      `${variantClass[variant]} ${sizeClass[size]} ${className}`
    }
  >
    {leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>}
    {children != null && <span>{children}</span>}
    {rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
  </button>
);
