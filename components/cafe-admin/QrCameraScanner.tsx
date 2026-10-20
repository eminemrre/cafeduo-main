/**
 * QrCameraScanner — the camera view inside QrScannerModal.
 *
 * Reads QR codes from the back camera a few times a second. The browser's own BarcodeDetector is
 * tried first where it exists; when it is missing or throws (iOS reports "Barcode detection
 * service unavailable") the frame goes to jsQR, a plain JavaScript decoder. Nothing here needs
 * WebAssembly or a CDN, so the site's CSP (script-src 'self') does not get in the way.
 */
import React, { useEffect, useRef } from 'react';
import type jsQRType from 'jsqr';

interface QrCameraScannerProps {
  onScan: (code: string) => void;
  onError: (message: string) => void;
}

interface NativeDetector {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
}

type NativeDetectorConstructor = new (options: { formats: string[] }) => NativeDetector;

const SCAN_INTERVAL_MS = 250;
/** Frames are scaled down to this width before decoding; QR codes stay readable. */
const DECODE_WIDTH = 640;

const cameraErrorMessage = (err: unknown): string => {
  const name = err instanceof Error ? err.name : '';
  const message = err instanceof Error ? err.message : String(err || '');
  if (name === 'NotAllowedError' || /permission|denied|notallowed/i.test(message)) {
    return 'Kamera izni reddedildi. Tarayıcı izinlerinden kameraya erişim ver veya kodu elle gir.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Bu cihazda kullanılabilir bir kamera bulunamadı. Kodu elle gir.';
  }
  return 'Kamera açılamadı. Kodu elle gir.';
};

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({ onScan, onError }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const callbacks = useRef({ onScan, onError });
  callbacks.current = { onScan, onError };

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let jsQR: typeof jsQRType | null = null;
    let native: NativeDetector | null = null;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const Detector = (window as unknown as { BarcodeDetector?: NativeDetectorConstructor })
      .BarcodeDetector;
    if (Detector) {
      try {
        native = new Detector({ formats: ['qr_code'] });
      } catch {
        native = null;
      }
    }

    const decodeFrame = async (video: HTMLVideoElement): Promise<string | null> => {
      if (native) {
        try {
          const found = await native.detect(video);
          const raw = found.find((code) => code.rawValue)?.rawValue;
          if (raw) return raw;
          return null;
        } catch {
          // The native detector exists but cannot work here: use jsQR from now on.
          native = null;
        }
      }
      if (!context) return null;
      jsQR ??= (await import('jsqr')).default;
      const scale = Math.min(1, DECODE_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      return (
        jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' })?.data ||
        null
      );
    };

    const scan = async (): Promise<void> => {
      const video = videoRef.current;
      if (stopped || !video) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const code = await decodeFrame(video);
        if (stopped) return;
        if (code) {
          stopped = true;
          callbacks.current.onScan(code);
          return;
        }
      }
      timer = window.setTimeout((): void => {
        void scan();
      }, SCAN_INTERVAL_MS);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        callbacks.current.onError('Bu tarayıcı kameraya erişemiyor. Kodu elle gir.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (err) {
        if (!stopped) callbacks.current.onError(cameraErrorMessage(err));
        return;
      }
      const video = videoRef.current;
      if (stopped || !video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay may wait for the stream; the scan loop simply starts once frames arrive.
      }
      void scan();
    };

    void start();

    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      data-testid="qr-camera-video"
      muted
      playsInline
      aria-label="Kamera görüntüsü"
    />
  );
};

export default QrCameraScanner;
