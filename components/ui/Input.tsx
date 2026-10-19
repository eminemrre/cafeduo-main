/**
 * Input — the v2 field (DESIGN.md, input): ice fill, 3 px ink underline, square,
 * label above. Focus is the 3 px ink ring every control shares.
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
          className="mb-2 block font-candy-body text-[0.9375rem] font-medium text-carbon"
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
            'duo-input block w-full font-candy-body text-base text-carbon',
            'px-3.5',
            icon ? 'pl-10' : '',
            'duo-focus focus:bg-paper placeholder:text-carbon-muted',
            disabled ? 'cursor-not-allowed opacity-50' : '',
            hasError ? 'border-b-candy-danger!' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
      </div>
      {hasError && (
        <p id={`${fieldId}-err`} className="mt-1.5 text-sm font-medium text-candy-danger">
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
