/**
 * Input — Riso Kantin primitive.
 *
 * Crisp 2px ink border, paper surface, no rounded corners (Riso = print).
 * Focus ring is the three-layer ink+pink+blue offset; matches Button focus.
 *
 * Renders an optional <label>, error message, and helper text. Pass an
 * `icon` to mount a leading lucide-react icon.
 */

import React, { forwardRef, useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  icon?: React.ReactNode;
  /** Width: 'full' (default) for forms, 'auto' for inline. */
  width?: 'full' | 'auto';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, errorText, icon, width = 'full', className = '', id, disabled, ...rest },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hasError = Boolean(errorText);

  return (
    <div className={width === 'full' ? 'w-full' : 'inline-block'}>
      {label && (
        <label
          htmlFor={fieldId}
          className="mb-1.5 block font-riso-body text-xs font-semibold uppercase tracking-[0.12em] text-carbon-soft"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-carbon-muted"
          >
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${fieldId}-err` : helperText ? `${fieldId}-help` : undefined
          }
          className={[
            'duo-input block w-full font-riso-body text-base text-carbon',
            'bg-paper border-2 border-carbon',
            'px-3.5 py-2.5',
            icon ? 'pl-10' : '',
            'riso-focus placeholder:text-carbon-muted',
            disabled ? 'cursor-not-allowed opacity-50' : '',
            hasError ? 'border-riso-redox' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
      </div>
      {hasError && (
        <p id={`${fieldId}-err`} className="mt-1.5 text-sm font-medium text-riso-redox">
          {errorText}
        </p>
      )}
      {!hasError && helperText && (
        <p id={`${fieldId}-help`} className="mt-1.5 text-sm text-carbon-muted">
          {helperText}
        </p>
      )}
    </div>
  );
});
