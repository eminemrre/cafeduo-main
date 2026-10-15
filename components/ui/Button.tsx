/**
 * Button — Riso Kantin primitive.
 *
 * Risograph "stamped on paper" feel: hard ink border + double offset shadow
 * that collapses on press (the element physically translates 2px). Five tones
 * cover every interaction state: primary action, secondary, neutral, success,
 * danger.
 *
 * Forwards ref so parent components can attach focus management.
 */

import React, { forwardRef } from 'react';

export type ButtonTone = 'pink' | 'blue' | 'mustard' | 'paper' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis + colour. Pink = primary action. */
  tone?: ButtonTone;
  size?: ButtonSize;
  /** Render a full-width block. */
  block?: boolean;
  /** Optional leading icon (lucide-react element). */
  leadingIcon?: React.ReactNode;
  /** Optional trailing icon. */
  trailingIcon?: React.ReactNode;
}

const TONE_CLASS: Record<ButtonTone, string> = {
  pink: 'bg-riso-pink text-carbon hover:bg-riso-pink-deep hover:text-paper',
  blue: 'bg-riso-blue text-paper hover:bg-riso-blue-deep',
  mustard: 'bg-riso-mustard text-carbon hover:bg-riso-mustard-deep',
  paper: 'bg-paper text-carbon hover:bg-paper-deep',
  danger: 'bg-riso-redox text-paper hover:opacity-90',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-base gap-2',
  lg: 'px-6 py-3.5 text-lg gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    tone = 'pink',
    size = 'md',
    block = false,
    leadingIcon,
    trailingIcon,
    className = '',
    disabled,
    children,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={[
        // Base
        'duo-button relative inline-flex items-center justify-center',
        'font-riso-body font-semibold tracking-wide',
        'border-2 border-carbon',
        'transition-[box-shadow,transform,background-color] duration-150 ease-out',
        'riso-press riso-focus',
        'select-none',
        // Pressed-state shadow collapse handled by riso-press class
        'riso-shadow-sm',
        // Tone + size
        TONE_CLASS[tone],
        SIZE_CLASS[size],
        // Layout modifiers
        block ? 'w-full' : '',
        disabled ? 'cursor-not-allowed opacity-50 pointer-events-none' : 'cursor-pointer',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {leadingIcon && <span className="shrink-0 flex items-center">{leadingIcon}</span>}
      <span>{children}</span>
      {trailingIcon && <span className="shrink-0 flex items-center">{trailingIcon}</span>}
    </button>
  );
});
