/**
 * Admin Modal — Riso Kantin re-skin (PR #24). API preserved.
 *
 * Hard 2px ink border + double offset spot shadow. Backdrop is ink with
 * subtle blur. Title gets the display font; eyebrow stays small but goes
 * mono uppercase.
 */
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  footer?: React.ReactNode;
  titleId?: string;
}

const widthClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  eyebrow,
  size = 'md',
  children,
  footer,
  titleId = 'cc-modal-title',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-carbon/80"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={
              `w-full ${widthClass[size]} max-h-[calc(100vh-2rem)] flex flex-col ` +
              'bg-paper border-2 border-carbon riso-shadow-md overflow-hidden'
            }
          >
            <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b-2 border-carbon bg-paper-deep">
              <div className="flex flex-col gap-1">
                {eyebrow && (
                  <span className="font-riso-mono text-xs uppercase tracking-[0.16em] text-riso-pink-deep font-bold">
                    {eyebrow}
                  </span>
                )}
                <h2 id={titleId} className="font-riso-display text-2xl text-carbon">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="riso-focus shrink-0 border-2 border-carbon bg-paper p-1.5 text-carbon hover:bg-riso-pink transition-colors"
              >
                <X size={18} />
              </button>
            </header>
            <div className="px-6 py-5 overflow-y-auto bg-paper">{children}</div>
            {footer && (
              <footer className="px-6 py-4 border-t-2 border-carbon bg-paper-deep">{footer}</footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
