import React from 'react';
import { CheckCircle, KeyRound, RefreshCw, XCircle } from 'lucide-react';
import type { CafePinStatus } from './types';

interface PinManagerProps {
  currentPin: string;
  newPin: string;
  onNewPinChange: (pin: string) => void;
  onGeneratePin: () => void;
  onSubmit: () => Promise<void>;
  status: CafePinStatus;
  message: string;
  loading: boolean;
}

export const PinManager: React.FC<PinManagerProps> = ({
  currentPin,
  newPin,
  onNewPinChange,
  onGeneratePin,
  onSubmit,
  status,
  message,
  loading,
}) => {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit();
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="rf-panel border border-gray-800 rounded-2xl p-8 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <KeyRound className="text-green-400" />
          Günlük PIN Kodu
        </h2>

        <div className="mb-8 p-6 bg-black/30 rounded-xl border border-green-900/50 text-center">
          <div className="text-sm text-gray-400 mb-2">Mevcut PIN</div>
          <div className="text-4xl font-mono font-bold text-green-400 tracking-[0.5em]">{currentPin || '----'}</div>
          <p className="text-xs text-gray-500 mt-3">Bu PIN kodunu müşterilere verin</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
          <div>
            <label htmlFor="new-pin-input" className="block text-sm font-medium text-gray-400 mb-2">
              Yeni PIN Kodu (4-6 haneli)
            </label>
            <div className="flex gap-2">
              <input
                id="new-pin-input"
                type="text"
                value={newPin}
                onChange={(event) => onNewPinChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Yeni PIN girin"
                maxLength={6}
                className="flex-1 bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-green-500 outline-none font-mono text-xl tracking-widest text-center"
              />
              <button
                type="button"
                onClick={onGeneratePin}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                title="Rastgele PIN oluştur"
                aria-label="Rastgele PIN oluştur"
              >
                <RefreshCw size={20} className="text-gray-400" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !newPin}
            className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
              loading || !newPin ? 'bg-gray-700 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Güncelleniyor...
              </>
            ) : (
              <>
                <KeyRound size={20} />
                PIN'İ GÜNCELLE
              </>
            )}
          </button>
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

        <div className="mt-6 p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl text-sm text-blue-300">
          <p className="font-bold mb-2">İpuçları:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-400/80">
            <li>Her gün PIN kodunu değiştirmeniz önerilir.</li>
            <li>PIN'i masalarda veya kasada gösterebilirsiniz.</li>
            <li>Kolay tahmin edilebilir PIN kullanmayın.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
