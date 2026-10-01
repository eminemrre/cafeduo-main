/**
 * Admin Button — Riso Kantin re-skin (PR #24).
 *
 * Public API (variant/size/leftIcon/rightIcon) is unchanged so AdminDashboard
 * compiles without edits. Internally the styles come from the Riso Kantin
 * tokens defined in index.css + tailwind.config.js.
 *   - primary   → riso-pink (main CTA)
 *   - secondary → paper + ink border
 *   - ghost     → transparent, ink hover
 *   - danger    → riso-redox
 */
import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<Variant, string> = {
  primary:
    'bg-riso-pink text-carbon border-carbon hover:bg-riso-pink-deep hover:text-paper riso-shadow-sm',
  secondary: 'bg-paper text-carbon border-carbon hover:bg-paper-deep riso-shadow-sm',
  ghost: 'bg-transparent text-carbon border-transparent hover:bg-paper-deep',
  danger:
    'bg-paper text-riso-redox border-riso-redox hover:bg-riso-redox hover:text-paper riso-shadow-sm',
};

const sizeClass: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[0.8125rem] gap-1.5',
  md: 'px-4 py-2.5 text-[0.9375rem] gap-2',
  lg: 'px-6 py-3 text-[1rem] gap-2.5',
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
      'duo-button inline-flex items-center justify-center font-riso-body font-semibold border-2 ' +
      'transition-[box-shadow,transform,background-color] duration-150 ' +
      'riso-focus riso-press disabled:cursor-not-allowed disabled:opacity-50 ' +
      `${variantClass[variant]} ${sizeClass[size]} ${className}`
    }
  >
    {leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>}
    {children != null && <span>{children}</span>}
    {rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
  </button>
);
