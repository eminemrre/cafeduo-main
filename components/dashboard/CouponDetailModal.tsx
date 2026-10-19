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
      <div className="absolute inset-0 bg-carbon/80" onClick={onClose} aria-hidden="true" />

      <div
        className="duo-float relative w-full max-w-md bg-paper overflow-hidden"
        data-testid="coupon-detail-modal"
      >
        <span aria-hidden="true" className="block h-2 bg-riso-spring" />
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h2 className="font-riso-display text-[28px] leading-none text-carbon truncate">
              {coupon.title}
            </h2>
            <p className="mt-1.5 text-[13px] text-carbon-soft">Kasada göster, çalışan okutsun.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="riso-focus shrink-0 w-11 h-11 bg-paper-deep text-carbon hover:bg-carbon hover:text-paper flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="border-t-[3px] border-dotted border-carbon/35 p-6 flex flex-col items-center gap-5">
          <p className="font-riso-body text-sm text-carbon-soft text-center max-w-xs">
            Kafe çalışanı bu QR kodu okutarak kuponu doğrular. Okunamazsa altındaki kodu manuel
            girebilir.
          </p>

          {/* Big QR on an ice well */}
          <div className="p-4 bg-paper-deep">
            <QRCodeSVG
              value={coupon.code}
              size={200}
              bgColor="#EEF6F8"
              fgColor="#17140F"
              level="M"
              includeMargin={false}
              aria-label={`Kupon kodu: ${coupon.code}`}
            />
          </div>

          {/* Human-readable code with copy */}
          <div className="w-full">
            <p className="mb-1.5 text-[13px] font-medium text-carbon-soft">Manuel kod</p>
            <div className="flex items-stretch gap-0">
              <code className="flex-1 px-3 py-3 font-riso-mono text-base font-semibold text-carbon bg-paper-deep break-all">
                {coupon.code}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Kuponu kopyala"
                className={`riso-focus shrink-0 min-h-12 px-4 transition-colors flex items-center gap-1.5 font-riso-body text-sm font-semibold ${
                  copied ? 'bg-riso-spring text-carbon' : 'bg-riso-pink text-carbon'
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
            <div role="status" className="w-full bg-riso-redox/10 p-3 text-sm text-carbon font-riso-body">
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
