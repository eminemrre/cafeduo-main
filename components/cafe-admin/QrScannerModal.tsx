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
 * The camera view (QrCameraScanner) tries the browser's BarcodeDetector and
 * falls back to jsQR, so it works on iOS too and needs no WebAssembly or CDN.
 * Lazy-loaded so it doesn't ship in the dashboard bundle for users who never
 * open the cafe-admin panel.
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, AlertTriangle } from 'lucide-react';

// Lazy import to keep the dashboard bundle slim — only the cafe-admin
// panel needs this, and even then only when the scanner button is clicked.
const QrCameraScanner = lazy(() => import('./QrCameraScanner'));

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
      className="duo-scope fixed inset-0 z-[150] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-carbon/80" onClick={onClose} aria-hidden="true" />

      <div
        className="duo-float relative w-full max-w-md bg-paper overflow-hidden"
        data-testid="qr-scanner-modal"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b-[3px] border-dotted border-carbon/35 flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <Camera size={18} className="text-carbon shrink-0" aria-hidden="true" />
            <div>
              <h3 className="font-candy-body text-base sm:text-lg text-carbon">QR kodu okut</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="duo-focus shrink-0 w-11 h-11 bg-paper-deep text-carbon hover:bg-carbon hover:text-paper flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-carbon-soft font-candy-body">
            Kuponu telefon ekranı veya yazıcı çıktısı olarak göster. Kamera odaklanınca kod otomatik
            okunur ve doğrulama formuna yazılır.
          </p>

          {error ? (
            <div className="bg-candy-danger/15 p-3 text-xs text-carbon font-candy-body flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-candy-danger" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="relative aspect-square w-full overflow-hidden bg-carbon">
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center text-paper font-candy-body text-xs">
                    Kamera hazırlanıyor...
                  </div>
                }
              >
                <QrCameraScanner onScan={onScan} onError={setError} />
              </Suspense>
              {/* Framing reticle — purely decorative, helps the user
                  position the QR within the camera frame */}
              <div className="pointer-events-none absolute inset-6 border-2 border-paper/80" />
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="duo-focus min-h-11 bg-paper-deep text-carbon font-candy-body text-[0.9375rem] font-semibold hover:bg-paper-dim transition-colors"
          >
            Elle girişe dön
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QrScannerModal;
