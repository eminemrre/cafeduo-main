/**
 * QrScannerModal — opens the device camera and pipes detected QR codes
 * back to the cafe-admin scanner.
 *
 * Behaviour:
 *   - First scan that returns a non-empty string triggers `onScan(code)`
 *     and the modal closes. The parent then writes the value into the
 *     manual-entry input and submits as usual.
 *   - If the user denies camera permission, the error message is
 *     surfaced inside the modal so they can fall back to manual entry.
 *   - Esc closes the modal. Backdrop click also closes.
 *
 * Library: @yudiel/react-qr-scanner — modern React 18+ wrapper around
 * the BarcodeDetector API with fallback to a polyfill scanner. Lazy-
 * loaded so the dependency doesn't ship in the dashboard bundle for
 * users who never open the cafe-admin panel.
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, AlertTriangle } from 'lucide-react';

// Lazy import to keep the dashboard bundle slim — only the cafe-admin
// panel needs this, and even then only when the scanner button is clicked.
const Scanner = lazy(() =>
  import('@yudiel/react-qr-scanner').then((mod) => ({ default: mod.Scanner }))
);

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onScan }) => {
  const [error, setError] = useState<string | null>(null);

  // Reset error state on each open so a previous permission denial
  // doesn't linger when the user reopens the modal.
  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  // Esc → close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kupon QR kodunu okut"
      className="riso-kantin fixed inset-0 z-[150] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-carbon/75" onClick={onClose} />

      <div
        className="relative w-full max-w-md bg-paper overflow-hidden"
        data-testid="qr-scanner-modal"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b-[3px] border-dotted border-carbon/35 flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <Camera size={18} className="text-riso-blue shrink-0" />
            <div>
              <h3 className="font-riso-body text-base sm:text-lg text-carbon">
                QR Kodu Okut
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="riso-focus shrink-0 w-9 h-9 bg-paper text-carbon hover:bg-riso-redox hover:text-paper flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-carbon-soft font-riso-body">
            Kuponu telefon ekranı veya yazıcı çıktısı olarak göster. Kamera odaklanınca kod otomatik
            okunur ve doğrulama formuna yazılır.
          </p>

          {error ? (
            <div className="bg-riso-redox/15 p-3 text-xs text-carbon font-riso-body flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-riso-redox" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="relative aspect-square w-full overflow-hidden bg-carbon">
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center text-paper font-riso-body text-xs">
                    Kamera hazırlanıyor...
                  </div>
                }
              >
                <Scanner
                  formats={['qr_code']}
                  scanDelay={500}
                  onScan={(results) => {
                    // Library returns an array of detected codes; take the
                    // first non-empty payload and close.
                    const first = Array.isArray(results) ? results[0] : null;
                    const raw = first?.rawValue || '';
                    if (raw) {
                      onScan(raw);
                    }
                  }}
                  onError={(err) => {
                    const message =
                      err instanceof Error
                        ? err.message
                        : typeof err === 'string'
                          ? err
                          : 'Kamera açılamadı.';
                    setError(
                      message.toLowerCase().includes('permission') ||
                        message.toLowerCase().includes('denied') ||
                        message.toLowerCase().includes('notallowed')
                        ? 'Kamera izni reddedildi. Tarayıcı izinlerinden kameraya erişim ver veya kodu manuel gir.'
                        : `Kamera açılamadı: ${message}`
                    );
                  }}
                  styles={{
                    container: { width: '100%', height: '100%' },
                    video: { width: '100%', height: '100%', objectFit: 'cover' },
                  }}
                />
              </Suspense>
              {/* Riso framing reticle — purely decorative, helps the user
                  position the QR within the camera frame */}
              <div className="pointer-events-none absolute inset-6 border-2 border-paper/80" />
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="riso-focus bg-paper-deep text-carbon py-2 font-riso-body text-xs font-bold hover:bg-paper-dim transition-colors"
          >
            Manuel Girişe Dön
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QrScannerModal;
