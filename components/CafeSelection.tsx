import React from 'react';
import { MapPin, Navigation, Coffee, AlertTriangle, CheckCircle, LocateFixed } from 'lucide-react';
import type { User } from '../types';
import { useCafeSelection } from '../hooks/useCafeSelection';

interface CafeSelectionProps {
  currentUser: User;
  onCheckInSuccess: (cafeName: string, tableNumber: string, cafeId: string | number) => void;
}

export const CafeSelection: React.FC<CafeSelectionProps> = ({ currentUser, onCheckInSuccess }) => {
  const {
    cafes,
    selectedCafeId,
    tableNumber,
    loading,
    error,
    selectedCafe,
    maxTableCount,
    locationStatus,
    setSelectedCafeId,
    setTableNumber,
    clearError,
    requestLocationAccess,
    checkIn,
  } = useCafeSelection({ currentUser, onCheckInSuccess });

  return (
    <div className="min-h-screen bg-[var(--rf-bg)] text-[var(--rf-ink)] pt-24 pb-10 px-4 font-sans relative overflow-hidden">
      <div className="absolute inset-0 rf-grid opacity-[0.06] pointer-events-none" />
      <div className="max-w-md w-full mx-auto bg-[linear-gradient(170deg,rgba(8,14,30,0.96),rgba(10,24,52,0.88))] border border-cyan-400/25 rounded-2xl p-8 shadow-[0_30px_70px_rgba(0,0,0,0.45)] relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60 blur-sm" />

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-400/35 shadow-[0_10px_25px_rgba(0,217,255,0.2)]">
            <MapPin size={32} className="text-cyan-300" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Kafe Giriş</h1>
          <p className="text-[var(--rf-muted)] text-sm">Oyunlara katılmak için konum izniyle kafe doğrulaması yapın.</p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-300 p-4 rounded-xl mb-6 text-sm animate-shake" role="alert" aria-live="polite">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">Giriş Başarısız!</p>
                <p>{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-5" aria-busy={loading} aria-live="polite">
          <div>
            <label htmlFor="checkin-cafe-select" className="block text-[var(--rf-muted)] text-sm mb-2 font-bold">
              Kafe Seçimi
            </label>
            <div className="relative">
              <Coffee className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <select
                id="checkin-cafe-select"
                value={selectedCafeId || ''}
                onChange={(event) => setSelectedCafeId(event.target.value)}
                data-testid="checkin-cafe-select"
                className="w-full bg-black/40 border border-gray-600 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-cyan-400 appearance-none cursor-pointer focus:shadow-[0_0_20px_rgba(0,217,255,0.2)]"
              >
                {cafes.map((cafe) => (
                  <option key={cafe.id} value={cafe.id}>
                    {cafe.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">▼</div>
            </div>
          </div>

          <div>
            <label htmlFor="checkin-table-input" className="block text-[var(--rf-muted)] text-sm mb-2 font-bold">
              Masa Numarası
            </label>
            <div className="relative">
              <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                id="checkin-table-input"
                type="number"
                placeholder={`1 - ${selectedCafe?.table_count || selectedCafe?.total_tables || 20}`}
                value={tableNumber}
                onChange={(event) => setTableNumber(event.target.value)}
                min="1"
                max={maxTableCount}
                data-testid="checkin-table-input"
                className="w-full bg-black/40 border border-gray-600 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(0,217,255,0.2)]"
              />
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void requestLocationAccess()}
              className="w-full py-3 rounded-xl font-semibold border border-cyan-400/35 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-100 flex items-center justify-center gap-2"
              onFocus={clearError}
            >
              <LocateFixed size={18} />
              Konumu Doğrula
            </button>

            <div className="mt-2 flex items-center justify-center gap-2 text-sm">
              {locationStatus === 'ready' ? (
                <span className="text-green-400 flex items-center gap-1">
                  <CheckCircle size={14} /> Konum doğrulandı
                </span>
              ) : locationStatus === 'requesting' ? (
                <span className="text-cyan-300">Konum alınıyor...</span>
              ) : locationStatus === 'denied' ? (
                <span className="text-red-300">Konum izni gerekli</span>
              ) : (
                <span className="text-gray-500">Devam etmek için konum izni verin</span>
              )}
            </div>

            <div className="p-3 bg-cyan-900/20 border border-cyan-700/30 rounded-lg text-center">
              <p className="text-xs text-cyan-200">
                Konum izni yalnızca kafe doğrulaması için kullanılır ve giriş sırasında kontrol edilir.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void checkIn()}
            disabled={loading || !tableNumber}
            data-testid="checkin-submit-button"
            className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
              loading || !tableNumber
                ? 'bg-gray-700 cursor-not-allowed opacity-50'
                : 'bg-cyan-500 hover:bg-cyan-400 text-[#041226] shadow-lg shadow-cyan-500/30 hover:scale-[1.02] active:scale-95'
            }`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Doğrulanıyor...
              </>
            ) : (
              <>
                <MapPin size={20} />
                KONUMU DOĞRULA & OYNA
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
