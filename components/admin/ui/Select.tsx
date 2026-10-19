/**
 * Admin Select — Riso Kantin re-skin (PR #24). API preserved.
 *
 * Custom-rendered listbox (used by AssignCafeAdminModal). Same keyboard nav
 * + outside-click contract, recoloured to Riso tokens.
 */
import React, { useEffect, useId, useRef, useState, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  label?: string;
  helper?: string;
  required?: boolean;
  value: string;
  options: SelectOption[];
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'data-testid'?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  helper,
  required,
  value,
  options,
  onChange,
  placeholder = 'Seçin',
  disabled,
  id,
  'data-testid': testId,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const triggerId = id || autoId;
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (open) {
      const i = options.findIndex((o) => o.value === value);
      setActiveIndex(i >= 0 ? i : 0);
    }
  }, [open, options, value]);

  const commit = useCallback(
    (opt: SelectOption) => {
      onChange(opt.value);
      setOpen(false);
    },
    [onChange]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else if (activeIndex >= 0 && options[activeIndex]) {
        commit(options[activeIndex]);
      }
      return;
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
    }
  };

  return (
    <div className="flex flex-col gap-1.5" ref={wrapRef}>
      {label && (
        <label
          htmlFor={triggerId}
          className="font-riso-body text-[0.9375rem] font-medium text-carbon"
        >
          {label}
          {required && <span className="text-riso-redox ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          id={triggerId}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${triggerId}-list`}
          disabled={disabled}
          onClick={() => !disabled && setOpen((v) => !v)}
          onKeyDown={onKeyDown}
          data-testid={testId}
          className={
            'duo-input w-full px-3.5 text-left ' +
            'font-riso-body text-base ' +
            'flex items-center justify-between gap-2 ' +
            'riso-focus transition-colors duration-150 ' +
            (disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-paper-dim')
          }
        >
          <span className={selected ? 'text-carbon' : 'text-carbon-muted'}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={16}
            className={
              'text-carbon transition-transform duration-200 ' + (open ? 'rotate-180' : '')
            }
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.ul
              id={`${triggerId}-list`}
              role="listbox"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="duo-float absolute z-50 mt-2 w-full max-h-64 overflow-y-auto bg-paper py-1"
            >
              {options.length === 0 ? (
                <li className="px-3 py-2 text-sm text-carbon-muted">Seçenek yok</li>
              ) : (
                options.map((opt, i) => {
                  const isSelected = opt.value === value;
                  const isActive = i === activeIndex;
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => commit(opt)}
                      className={
                        'mx-1 px-3 py-2 cursor-pointer flex items-center justify-between gap-2 ' +
                        (isActive ? 'bg-paper-deep ' : '') +
                        (isSelected ? 'font-semibold text-carbon' : 'text-carbon')
                      }
                    >
                      <div className="flex flex-col">
                        <span className="font-riso-body text-base font-medium">{opt.label}</span>
                        {opt.description && (
                          <span className="text-sm text-carbon-muted">{opt.description}</span>
                        )}
                      </div>
                      {isSelected && <Check size={16} className="shrink-0" />}
                    </li>
                  );
                })
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
      {helper && !open && <p className="text-sm text-carbon-muted">{helper}</p>}
    </div>
  );
};
