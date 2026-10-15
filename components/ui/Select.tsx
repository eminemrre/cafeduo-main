/**
 * Select — Riso Kantin primitive.
 *
 * Native <select> with full Riso styling: paper background, ink border,
 * custom chevron, no rounded corners. Keeps native a11y + mobile UX
 * (Headless UI not on the dep list and a custom listbox would break
 * mobile select pickers).
 */

import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  helperText?: string;
  errorText?: string;
  options: SelectOption[];
  /** Optional placeholder rendered as a disabled first option. */
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    helperText,
    errorText,
    options,
    placeholder,
    className = '',
    id,
    disabled,
    value,
    ...rest
  },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hasError = Boolean(errorText);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={fieldId}
          className="mb-1.5 block font-riso-body text-xs font-semibold uppercase tracking-[0.12em] text-carbon-soft"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          disabled={disabled}
          value={value}
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${fieldId}-err` : helperText ? `${fieldId}-help` : undefined
          }
          className={[
            'duo-input block w-full appearance-none font-riso-body text-base text-carbon',
            'bg-paper border-2 border-carbon',
            'pl-3.5 pr-10 py-2.5',
            'riso-focus',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            hasError ? 'border-riso-redox' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-carbon"
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
