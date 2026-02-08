import React, { useMemo } from 'react';
import { CheckCircle, Coffee, QrCode, XCircle } from 'lucide-react';
import { RetroButton } from '../RetroButton';
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="rf-panel border border-cyan-400/20 rounded-2xl p-8 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <QrCode className="text-blue-400" />
          Kupon Kullan
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="coupon-code-input" className="block text-sm font-medium text-gray-400 mb-2">
              Kupon Kodu
            </label>
            <input
              id="coupon-code-input"
              type="text"
              value={couponCode}
              onChange={(event) => onCouponCodeChange(event.target.value.toUpperCase())}
              placeholder="Kupon kodunu girin..."
              className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono text-lg tracking-wider"
            />
          </div>

          <RetroButton type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? 'DOĞRULANIYOR...' : 'KUPONU ONAYLA'}
          </RetroButton>
        </form>

        {status !== 'idle' && (
          <div
            className={`mt-6 p-4 rounded-xl border flex items-center gap-3 ${
              status === 'success'
                ? 'bg-green-900/20 border-green-900/50 text-green-400'
                : 'bg-red-900/20 border-red-900/50 text-red-400'
            }`}
            role="status"
            aria-live="polite"
          >
            {status === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
            <p className="font-medium">{message}</p>
          </div>
        )}
      </div>

      <div className="rf-panel border border-cyan-400/20 rounded-2xl p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
        <h2 className="text-xl font-bold text-white mb-6">Son İşlem Detayı</h2>

        {lastItem ? (
          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-xl border border-gray-800">
              <div className="text-sm text-gray-500 mb-1">Ürün</div>
              <div className="text-lg font-bold text-white">{lastItemTitle}</div>
            </div>
            <div className="p-4 bg-black/30 rounded-xl border border-gray-800">
              <div className="text-sm text-gray-500 mb-1">Kupon Kodu</div>
              <div className="text-lg font-mono text-yellow-500 tracking-wider">{lastItem.code}</div>
            </div>
            <div className="p-4 bg-black/30 rounded-xl border border-gray-800">
              <div className="text-sm text-gray-500 mb-1">İşlem Zamanı</div>
              <div className="text-white">{new Date().toLocaleString('tr-TR')}</div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
            <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
              <Coffee size={24} className="opacity-50" />
            </div>
            <p>Henüz işlem yapılmadı</p>
          </div>
        )}
      </div>
    </div>
  );
};
