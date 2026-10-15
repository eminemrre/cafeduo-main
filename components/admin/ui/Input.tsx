/**
 * Admin Input — Riso Kantin re-skin (PR #24). API preserved.
 */
import React, { forwardRef, useId } from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helper, error, required, id, className = '', ...rest }, ref) => {
    const autoId = useId();
    const inputId = id || rest.name || autoId;
    const describedBy = error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="font-riso-body text-xs font-semibold uppercase tracking-[0.12em] text-carbon-soft"
          >
            {label}
            {required && <span className="text-riso-redox ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={
            'duo-input w-full bg-paper border-2 px-3.5 py-2.5 font-riso-body ' +
            'text-base text-carbon placeholder:text-carbon-muted ' +
            'riso-focus ' +
            (error ? 'border-riso-redox ' : 'border-carbon ') +
            className
          }
          {...rest}
        />
        {error ? (
          <p id={`${inputId}-error`} className="text-sm font-medium text-riso-redox">
            {error}
          </p>
        ) : helper ? (
          <p id={`${inputId}-helper`} className="text-sm text-carbon-muted">
            {helper}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
