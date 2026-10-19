import React, { useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle, Coffee, QrCode, XCircle } from 'lucide-react';
import { RetroButton } from '../RetroButton';
import { QrScannerModal } from './QrScannerModal';
import type { CafeCouponStatus, CouponItem } from './types';

interface CouponScannerProps {
  couponCode: string;
  onCouponCodeChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  status: CafeCouponStatus;
  message: string;
  submitting: boolean;
  lastItem: CouponItem | null;
}

export const CouponScanner: React.FC<CouponScannerProps> = ({
  couponCode,
  onCouponCodeChange,
  onSubmit,
  status,
  message,
  submitting,
  lastItem,
}) => {
  const lastItemTitle = useMemo(
    () => String(lastItem?.item_title || lastItem?.itemTitle || 'Bilinmiyor'),
    [lastItem]
  );

  /** When true, the camera scanner modal is mounted. */
  const [scannerOpen, setScannerOpen] = useState(false);
  /** Stable ref to the latest onSubmit so the scan callback can invoke a
   *  fresh submit without listing the prop as a dependency. */
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit();
  };

  // When the QR scanner returns a code, write it into the manual-entry input
  // (so the cafe admin can see what was scanned + edit if needed) and auto-
  // submit. Close the modal regardless of whether submit succeeds or fails;
  // status banner below will reflect the outcome.
  const handleScan = (code: string) => {
    const trimmed = String(code || '')
      .trim()
      .toUpperCase();
    if (!trimmed) return;
    onCouponCodeChange(trimmed);
    setScannerOpen(false);
    // microtask so onCouponCodeChange's state flush propagates before submit
    Promise.resolve().then(() => {
      void onSubmitRef.current();
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-paper-deep p-6 sm:p-8">
        <h2 className="font-candy-display text-[1.75rem] leading-none text-carbon mb-6 flex items-center gap-2">
          <QrCode aria-hidden="true" />
          Kupon kullan
        </h2>

        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          data-testid="open-qr-scanner-button"
          className="duo-focus w-full mb-6 min-h-12 bg-carbon text-paper px-4 font-candy-body text-[0.9375rem] font-semibold flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <Camera size={18} />
          Kamerayla QR Oku
        </button>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="coupon-code-input"
              className="block text-[0.9375rem] font-medium text-carbon mb-2 font-candy-body"
            >
              Kupon Kodu{' '}
              <span className="font-normal text-carbon-muted">(manuel giriş)</span>
            </label>
            <input
              id="coupon-code-input"
              type="text"
              value={couponCode}
              onChange={(event) => onCouponCodeChange(event.target.value.toUpperCase())}
              placeholder="CD-XXXX-XXXX-XXXX"
              className="duo-input duo-focus w-full px-4 text-carbon placeholder:text-carbon-muted font-candy-mono text-lg tracking-[0.04em] focus:bg-paper"
            />
          </div>

          <RetroButton type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? 'Doğrulanıyor…' : 'Kuponu onayla'}
          </RetroButton>
        </form>

        {status !== 'idle' && (
          <div
            className={`mt-6 p-4 flex items-center gap-3 ${ status === 'success' ? 'bg-candy-fistik/25 text-carbon' : 'bg-candy-danger/20 text-carbon' }`}
            role="status"
            aria-live="polite"
          >
            {status === 'success' ? (
              <CheckCircle size={20} className="text-[#177A41] shrink-0" />
            ) : (
              <XCircle size={20} className="text-candy-danger shrink-0" />
            )}
            <p className="font-medium font-candy-body">{message}</p>
          </div>
        )}
      </div>

      <div className="bg-paper-deep p-6 sm:p-8 relative overflow-hidden">
        <h2 className="font-candy-display text-[1.75rem] leading-none text-carbon mb-6">
          Son işlem
        </h2>

        {lastItem ? (
          <div className="space-y-4">
            <div className="p-4 bg-paper">
              <div className="text-[0.8125rem] text-carbon-soft mb-1 font-candy-body">
                Ürün
              </div>
              <div className="text-lg font-bold text-carbon font-candy-body">{lastItemTitle}</div>
            </div>
            <div className="p-4 bg-paper">
              <div className="text-[0.8125rem] text-carbon-soft mb-1 font-candy-body">
                Kupon Kodu
              </div>
              <div className="text-lg font-candy-mono text-carbon font-semibold">
                {lastItem.code}
              </div>
            </div>
            <div className="p-4 bg-paper">
              <div className="text-[0.8125rem] text-carbon-soft mb-1 font-candy-body">
                İşlem Zamanı
              </div>
              <div className="text-carbon font-candy-body">{new Date().toLocaleString('tr-TR')}</div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-carbon-soft py-12">
            <Coffee size={32} strokeWidth={2} className="mb-3 text-carbon-muted" aria-hidden="true" />
            <p className="font-candy-body text-sm">Henüz işlem yapılmadı</p>
          </div>
        )}
      </div>

      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  );
};
