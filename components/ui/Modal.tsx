/**
 * Modal — the shared dialog shell in the v2 language: paper floating on the ink
 * scrim with the one soft shadow (DESIGN.md), a Baloo title, a dotted rule under
 * the header and an ice footer for the actions.
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Show the X close button in the header. */
  showClose?: boolean;
  children: React.ReactNode;
  /** Optional footer (typically action buttons). */
  footer?: React.ReactNode;
  /** Width preset. */
  size?: 'sm' | 'md' | 'lg';
  'data-testid'?: string;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  showClose = true,
  children,
  footer,
  size = 'md',
  'data-testid': testId,
}) => {
  // Esc-to-close + body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = original;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          data-testid={testId}
        >
          {/* Backdrop — the ink scrim */}
          <button
            type="button"
            aria-label="Modal'ı kapat"
            onClick={onClose}
            className="absolute inset-0 bg-carbon/85 cursor-default"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={['duo-float relative w-full bg-paper', SIZE_CLASS[size]].join(' ')}
          >
            {(title || showClose) && (
              <div className="flex items-start justify-between gap-4 border-b-[3px] border-dotted border-carbon/35 p-5 sm:p-6">
                {title && (
                  <h2
                    id="modal-title"
                    className="font-riso-display text-[1.75rem] leading-none text-carbon"
                  >
                    {title}
                  </h2>
                )}
                {showClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Kapat"
                    className="riso-focus inline-flex h-11 w-11 shrink-0 items-center justify-center bg-paper-deep text-carbon hover:bg-carbon hover:text-paper transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
            <div className="p-5 sm:p-6">{children}</div>
            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-3 bg-paper-deep p-4 sm:p-5">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
