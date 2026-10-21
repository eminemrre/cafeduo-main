/**
 * Button — the panel's button primitive in the v2 language (DESIGN.md).
 *
 * Flat filled rectangles, 0 radius, no border and no shadow. Hover lifts the
 * button 2 px, a press scales it to 0.98. Candy fills carry ink text; ink and
 * danger carry paper text.
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
  pink: 'bg-candy-lokum text-carbon',
  blue: 'bg-candy-gok text-carbon',
  mustard: 'bg-candy-limon text-carbon',
  paper: 'bg-paper-deep text-carbon hover:bg-paper-dim',
  danger: 'bg-candy-danger text-paper',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 text-sm gap-1.5',
  md: 'min-h-12 px-5 text-base gap-2',
  lg: 'min-h-14 px-6 text-lg gap-2.5',
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
      type={type === 'submit' ? 'submit' : type === 'reset' ? 'reset' : 'button'}
      disabled={disabled}
      className={[
        // Base
        'duo-button relative inline-flex items-center justify-center',
        'font-candy-body font-semibold',
        'transition-[transform,background-color] duration-150 ease-out',
        'duo-focus select-none',
        disabled ? '' : 'hover:-translate-y-0.5 active:scale-[0.98]',
        // Tone + size
        TONE_CLASS[tone],
        SIZE_CLASS[size],
        // Layout modifiers
        block ? 'w-full' : '',
        disabled ? 'cursor-not-allowed opacity-45 pointer-events-none' : 'cursor-pointer',
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
