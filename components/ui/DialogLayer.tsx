import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './DialogLayer.css';

interface DialogLayerProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}

const scrollLocks = new Set<symbol>();
let previousOverflow = '';

function lockBodyScroll() {
  const lock = Symbol('dialog');
  if (scrollLocks.size === 0) previousOverflow = document.body.style.overflow;
  scrollLocks.add(lock);
  document.body.style.overflow = 'hidden';
  return () => {
    scrollLocks.delete(lock);
    if (scrollLocks.size === 0) document.body.style.overflow = previousOverflow;
  };
}

/** Native modal isolation keeps nested dialogs above transformed page surfaces. */
export function DialogLayer({ open, onClose, label, children }: DialogLayerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const unlock = lockBodyScroll();
    dialog.showModal();
    return () => {
      // Layout-effect cleanup closes while the element is still connected,
      // allowing the browser to return focus to the correct opener.
      dialog.close();
      unlock();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="duo-dialog-layer"
      aria-label={label}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onKeyDown={(event) => {
        // Portal events follow the React tree. Keep them in the active dialog,
        // away from its parent and background keyboard shortcuts.
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
          )
        ).filter(
          (node) =>
            node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      {children}
    </dialog>,
    document.body
  );
}
