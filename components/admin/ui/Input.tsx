/**
 * Admin Input — ice fill, 3 px ink underline, label above (DESIGN.md input). API preserved.
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
            className="font-candy-body text-[0.9375rem] font-medium text-carbon"
          >
            {label}
            {required && <span className="text-candy-danger ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={
            'duo-input w-full px-3.5 font-candy-body ' +
            'text-base text-carbon placeholder:text-carbon-muted ' +
            'duo-focus focus:bg-paper ' +
            (error ? 'border-b-candy-danger! ' : '') +
            className
          }
          {...rest}
        />
        {error ? (
          <p id={`${inputId}-error`} className="text-sm font-medium text-candy-danger">
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
