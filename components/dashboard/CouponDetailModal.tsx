/**
 * CouponDetailModal — large-QR fullscreen modal for cafe pos.
 *
 * When a user clicks "Kasada Göster" on an inventory ticket, this modal
 * pops up with a much bigger QR (200px) so a cafe admin can scan it
 * from a comfortable distance. Also shows the human-readable coupon
 * code as a fallback (cafe admin can type it into CouponScanner if
 * scanning fails) and a "Kodu Kopyala" button for clipboard fallback.
 *
 * Riso Kantin: ink-bordered paper modal, full-screen ink wash backdrop,
 * riso confetti accents in the corner, riso-pink press close button.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check } from 'lucide-react';
import type { RedeemedReward } from '../../types';

interface CouponDetailModalProps {
  isOpen: boolean;
  coupon: RedeemedReward | null;
  onClose: () => void;
}

export const CouponDetailModal: React.FC<CouponDetailModalProps> = ({
  isOpen,
  coupon,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  // Reset the "copied" badge whenever the modal opens for a new coupon — old
  // confirmation shouldn't carry over to the next pop.
  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen, coupon?.redeemId]);

  // Close on Escape — standard a11y for modal dialogs.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !coupon || typeof document === 'undefined') return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard might be blocked (insecure context, permissions). Silent —
      // user can still read the code from the modal and type it in.
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${coupon.title} kuponu detayı`}
      className="riso-kantin fixed inset-0 z-[140] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-carbon/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-md border-2 border-carbon bg-paper riso-shadow-md overflow-hidden"
        data-testid="coupon-detail-modal"
      >
        {/* Confetti sticker accents */}
        <div
          aria-hidden="true"
          className="absolute top-3 right-14 h-2 w-12 bg-riso-mustard rotate-[-4deg] pointer-events-none hidden sm:block"
        />
        <div
          aria-hidden="true"
          className="absolute top-7 right-20 h-2 w-6 bg-riso-pink rotate-[6deg] pointer-events-none hidden sm:block"
        />

        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-carbon flex justify-between items-start gap-3">
          <div className="min-w-0">
            <p className="font-riso-mono text-[10px] uppercase tracking-[0.2em] text-carbon-muted font-bold">
              CafeDuo Kupon
            </p>
            <h2 className="font-riso-display text-lg sm:text-xl text-carbon uppercase tracking-[0.04em] mt-0.5 truncate">
              {coupon.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="riso-focus shrink-0 w-9 h-9 border-2 border-carbon bg-paper text-carbon hover:bg-riso-redox hover:text-paper flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center gap-5">
          <p className="font-riso-body text-sm text-carbon-soft text-center max-w-xs">
            Kafe çalışanı bu QR kodu okutarak kuponu doğrular. Okunamazsa altındaki kodu manuel
            girebilir.
          </p>

          {/* Big QR — ink-bordered paper tile */}
          <div className="p-4 border-2 border-carbon bg-paper riso-shadow-sm">
            <QRCodeSVG
              value={coupon.code}
              size={200}
              bgColor="#FBF7EE"
              fgColor="#141413"
              level="M"
              includeMargin={false}
              aria-label={`Kupon kodu: ${coupon.code}`}
            />
          </div>

          {/* Human-readable code with copy */}
          <div className="w-full">
            <p className="font-riso-mono text-[10px] uppercase tracking-[0.18em] text-carbon-muted font-bold mb-1.5">
              Manuel Kod
            </p>
            <div className="flex items-stretch gap-0 border-2 border-carbon">
              <code className="flex-1 px-3 py-2.5 font-riso-mono text-sm sm:text-base text-carbon bg-paper-deep break-all">
                {coupon.code}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Kuponu kopyala"
                className={`riso-focus shrink-0 px-3 border-l-2 border-carbon transition-colors flex items-center gap-1.5 font-riso-display text-xs font-bold uppercase tracking-wider ${
                  copied
                    ? 'bg-riso-spring text-carbon'
                    : 'bg-riso-pink text-carbon hover:bg-riso-pink-deep hover:text-carbon'
                }`}
              >
                {copied ? (
                  <>
                    <Check size={14} /> Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Kopyala
                  </>
                )}
              </button>
            </div>
          </div>

          {coupon.isUsed && (
            <div className="w-full border-2 border-carbon border-l-[6px] border-l-riso-redox bg-riso-redox/15 p-3 text-xs text-carbon font-riso-body">
              Bu kupon zaten kullanılmış. Kafede tekrar gösterirsen kabul edilmez.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CouponDetailModal;
