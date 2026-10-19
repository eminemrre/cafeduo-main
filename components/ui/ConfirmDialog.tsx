/**
 * ConfirmDialog — window.confirm'in v2 karşılığı.
 *
 * Promise tabanlı kullanım, mevcut sync confirm akışlarının minimal değişimle
 * async'e çevrilebilmesi için:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   ...
 *   const ok = await confirm({ message: 'Silinsin mi?', danger: true });
 *   if (!ok) return;
 *   ...
 *   return <>{confirmDialog}...</>
 *
 * Modal primitive'i üzerine kurulur (backdrop, Esc, scroll-lock oradan gelir).
 * Esc/backdrop kapatma = iptal (false).
 */
import React, { useCallback, useRef, useState } from 'react';
import { Modal } from './Modal';
import { RetroButton } from '../RetroButton';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Geri alınamaz/yıkıcı işlemlerde onay butonu redox (danger) olur. */
  danger?: boolean;
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((accepted: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      // Üst üste çağrılırsa öncekini iptal say (window.confirm'de imkânsızdı,
      // burada güvenli varsayılan).
      resolveRef.current?.(false);
      resolveRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const settle = useCallback((accepted: boolean) => {
    resolveRef.current?.(accepted);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const confirmDialog = (
    <Modal
      open={options !== null}
      onClose={() => settle(false)}
      title={options?.title ?? 'Emin misin?'}
      size="sm"
      data-testid="confirm-dialog"
      footer={
        options && (
          <div className="flex justify-end gap-3">
            <RetroButton variant="ghost" onClick={() => settle(false)}>
              {options.cancelLabel ?? 'Vazgeç'}
            </RetroButton>
            <RetroButton
              variant={options.danger ? 'danger' : 'primary'}
              onClick={() => settle(true)}
            >
              {options.confirmLabel ?? 'Evet'}
            </RetroButton>
          </div>
        )
      }
    >
      {options && (
        <p className="whitespace-pre-line font-candy-body text-carbon">{options.message}</p>
      )}
    </Modal>
  );

  return { confirm, confirmDialog };
}
