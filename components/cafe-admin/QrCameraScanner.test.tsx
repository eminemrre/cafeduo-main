import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { QrCameraScanner } from './QrCameraScanner';

const mockJsQR = jest.fn();
jest.mock('jsqr', () => ({ __esModule: true, default: (...args: unknown[]) => mockJsQR(...args) }));

const stopTrack = jest.fn();
const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;

const setCamera = (getUserMedia: jest.Mock | undefined) => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: getUserMedia ? { getUserMedia } : undefined,
  });
};

describe('QrCameraScanner', () => {
  beforeEach(() => {
    mockJsQR.mockReset();
    stopTrack.mockReset();
    // jsdom has no video frames or 2D canvas: give the video a size and the canvas a context.
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get: () => 4,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      configurable: true,
      get: () => 320,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      configurable: true,
      get: () => 240,
    });
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      drawImage: jest.fn(),
      getImageData: (_x: number, _y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      }),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  });

  it('falls back to jsQR when the browser detector is there but cannot work', async () => {
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      detect() {
        return Promise.reject(
          new DOMException('Barcode detection service unavailable.', 'NotSupportedError')
        );
      }
    };
    setCamera(jest.fn().mockResolvedValue(stream));
    mockJsQR.mockReturnValue({ data: 'KUPON-42' });
    const onScan = jest.fn();

    render(<QrCameraScanner onScan={onScan} onError={jest.fn()} />);

    await waitFor(() => expect(onScan).toHaveBeenCalledWith('KUPON-42'));
    expect(mockJsQR).toHaveBeenCalled();
  });

  it('uses the browser detector when it works', async () => {
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      detect() {
        return Promise.resolve([{ rawValue: 'KUPON-7' }]);
      }
    };
    setCamera(jest.fn().mockResolvedValue(stream));
    const onScan = jest.fn();

    render(<QrCameraScanner onScan={onScan} onError={jest.fn()} />);

    await waitFor(() => expect(onScan).toHaveBeenCalledWith('KUPON-7'));
    expect(mockJsQR).not.toHaveBeenCalled();
  });

  it('explains a refused camera permission', async () => {
    setCamera(
      jest.fn().mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    );
    const onError = jest.fn();

    render(<QrCameraScanner onScan={jest.fn()} onError={onError} />);

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Kamera izni reddedildi/))
    );
  });

  it('says so when the browser has no camera access at all', async () => {
    setCamera(undefined);
    const onError = jest.fn();

    render(<QrCameraScanner onScan={jest.fn()} onError={onError} />);

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/kameraya erişemiyor/))
    );
  });

  it('turns the camera off when it closes', async () => {
    setCamera(jest.fn().mockResolvedValue(stream));
    mockJsQR.mockReturnValue(null);

    const { unmount } = render(<QrCameraScanner onScan={jest.fn()} onError={jest.fn()} />);
    await waitFor(() => expect(mockJsQR).toHaveBeenCalled());
    unmount();

    expect(stopTrack).toHaveBeenCalled();
  });
});
