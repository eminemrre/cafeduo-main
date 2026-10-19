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
      <div className="border-2 border-carbon bg-paper riso-shadow-md p-8">
        <p className="font-riso-mono text-xs uppercase tracking-[0.18em] text-carbon-soft mb-3">
          Kupon Doğrulama
        </p>
        <h2 className="font-riso-display text-xl sm:text-2xl font-bold text-carbon mb-6 flex items-center gap-2 uppercase tracking-wide">
          <QrCode className="text-riso-blue" />
          Kupon Kullan
        </h2>

        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          data-testid="open-qr-scanner-button"
          className="riso-focus riso-press w-full mb-5 border-2 border-carbon bg-riso-blue text-carbon py-3 px-4 font-riso-display text-sm sm:text-base font-bold uppercase tracking-[0.1em] riso-shadow-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-[1px]"
        >
          <Camera size={18} />
          Kamerayla QR Oku
        </button>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="coupon-code-input"
              className="block text-sm font-bold text-carbon mb-2 uppercase tracking-[0.08em] font-riso-body"
            >
              Kupon Kodu{' '}
              <span className="font-normal text-carbon-muted normal-case">(manuel giriş)</span>
            </label>
            <input
              id="coupon-code-input"
              type="text"
              value={couponCode}
              onChange={(event) => onCouponCodeChange(event.target.value.toUpperCase())}
              placeholder="CD-XXXX-XXXX-XXXX"
              className="border-2 border-carbon bg-paper-deep w-full px-4 py-3 text-carbon placeholder:text-carbon-muted outline-none transition-all font-riso-mono text-lg tracking-wider focus:bg-paper focus:ring-2 focus:ring-riso-blue focus:ring-offset-2 focus:ring-offset-paper"
            />
          </div>

          <RetroButton type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? 'DOĞRULANIYOR...' : 'KUPONU ONAYLA'}
          </RetroButton>
        </form>

        {status !== 'idle' && (
          <div
            className={`mt-6 p-4 border-2 border-carbon flex items-center gap-3 ${
              status === 'success'
                ? 'bg-riso-spring/25 text-carbon'
                : 'bg-riso-redox/20 text-carbon'
            }`}
            role="status"
            aria-live="polite"
          >
            {status === 'success' ? (
              <CheckCircle size={20} className="text-riso-spring shrink-0" />
            ) : (
              <XCircle size={20} className="text-riso-redox shrink-0" />
            )}
            <p className="font-medium font-riso-body">{message}</p>
          </div>
        )}
      </div>

      <div className="border-2 border-carbon bg-paper-deep riso-shadow-md p-8 relative overflow-hidden">
        <div className="absolute top-3 right-3 h-2 w-12 bg-riso-pink rotate-[-4deg] pointer-events-none" />
        <h2 className="font-riso-display text-xl sm:text-2xl font-bold text-carbon mb-6 uppercase tracking-wide">
          Son İşlem Detayı
        </h2>

        {lastItem ? (
          <div className="space-y-4">
            <div className="p-4 bg-paper border-2 border-carbon">
              <div className="text-xs text-carbon-muted mb-1 font-riso-mono uppercase tracking-wider">
                Ürün
              </div>
              <div className="text-lg font-bold text-carbon font-riso-body">{lastItemTitle}</div>
            </div>
            <div className="p-4 bg-paper border-2 border-carbon">
              <div className="text-xs text-carbon-muted mb-1 font-riso-mono uppercase tracking-wider">
                Kupon Kodu
              </div>
              <div className="text-lg font-riso-mono text-riso-mustard-deep tracking-wider font-bold">
                {lastItem.code}
              </div>
            </div>
            <div className="p-4 bg-paper border-2 border-carbon">
              <div className="text-xs text-carbon-muted mb-1 font-riso-mono uppercase tracking-wider">
                İşlem Zamanı
              </div>
              <div className="text-carbon font-riso-body">{new Date().toLocaleString('tr-TR')}</div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-carbon-muted py-12">
            <div className="w-16 h-16 bg-paper border-2 border-carbon flex items-center justify-center mb-4">
              <Coffee size={24} className="text-carbon-muted" />
            </div>
            <p className="font-riso-body uppercase tracking-wide text-sm">Henüz işlem yapılmadı</p>
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
