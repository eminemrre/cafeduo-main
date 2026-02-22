import React from 'react';
import { MapPin, Navigation, Coffee, AlertTriangle, CheckCircle, LocateFixed, ChevronDown } from 'lucide-react';
import type { User } from '../types';
import { useCafeSelection } from '../hooks/useCafeSelection';
import { CyberMascot, MascotMood } from './CyberMascot';

interface CafeSelectionProps {
  currentUser: User;
  onCheckInSuccess: (cafeName: string, tableNumber: string, cafeId: string | number) => void;
}

export const CafeSelection: React.FC<CafeSelectionProps> = ({ currentUser, onCheckInSuccess }) => {
  const {
    cafes,
    selectedCafeId,
    tableNumber,
    tableVerificationCode,
    loading,
    error,
    selectedCafe,
    maxTableCount,
    locationStatus,
    setSelectedCafeId,
    setTableNumber,
    setTableVerificationCode,
    clearError,
    requestLocationAccess,
    checkIn,
  } = useCafeSelection({ currentUser, onCheckInSuccess });

  const fieldBaseClass =
    'rf-input rf-control h-12 font-sans text-[1.02rem] leading-[1.1] text-white tracking-normal';
  const fieldIconClass =
    'absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--rf-muted)] pointer-events-none transition-colors group-focus-within:text-cyan-300';

  const mascotMood: MascotMood = error ? 'angry' : (tableNumber.length > 0 ? 'typing' : 'neutral');

  return (
    <div className="min-h-screen rf-page-shell text-[var(--rf-ink)] pt-24 pb-[calc(8rem+env(safe-area-bottom))] px-4 font-sans relative overflow-hidden noise-bg">
      <div className="absolute inset-0 rf-grid opacity-[0.06] pointer-events-none" />

      <div className="relative w-full max-w-md mx-auto">
        <CyberMascot mood={mascotMood} className="hidden sm:block absolute -top-[70px] right-4 z-10" />

        <div className="w-full rf-screen-card p-6 sm:p-8 relative overflow-hidden rf-elevated">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60 blur-sm" />

          <div className="text-center mb-8">
            <p className="rf-terminal-strip justify-center mb-3">Check-In Gateway</p>
            <div className="w-16 h-16 bg-black flex items-center justify-center mx-auto mb-4 border-2 border-cyan-400/45 shadow-[4px_4px_0_rgba(255,0,234,0.3)]">
              <MapPin size={32} className="text-cyan-300" />
            </div>
            <h1 className="text-4xl font-display text-white mb-2 tracking-[0.08em] glitch-text" data-text="KAFE GİRİŞ">
              Kafe Giriş
            </h1>
            <p className="text-[var(--rf-muted)] text-sm uppercase tracking-[0.11em]">Oyunlara katılmak için konum izniyle kafe doğrulaması yapın.</p>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-800 text-red-300 p-4 mb-6 text-sm animate-shake" role="alert" aria-live="polite">
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
              <label htmlFor="checkin-cafe-select" className="block text-[var(--rf-muted)] text-sm mb-2 font-bold uppercase tracking-[0.12em]">
                Kafe Seçimi
              </label>
              <div className="relative group">
                <Coffee className={fieldIconClass} size={18} />
                <select
                  id="checkin-cafe-select"
                  value={selectedCafeId || ''}
                  onChange={(event) => setSelectedCafeId(event.target.value)}
                  data-testid="checkin-cafe-select"
                  className={`${fieldBaseClass} rf-input-icon-double appearance-none cursor-pointer`}
                >
                  {cafes.map((cafe) => (
                    <option key={cafe.id} value={cafe.id}>
                      {cafe.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--rf-muted)] pointer-events-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="checkin-table-input" className="block text-[var(--rf-muted)] text-sm mb-2 font-bold uppercase tracking-[0.12em]">
                Masa Numarası
              </label>
              <div className="relative group">
                <Navigation className={fieldIconClass} size={18} />
                <input
                  id="checkin-table-input"
                  type="number"
                  placeholder={`1 - ${selectedCafe?.table_count || selectedCafe?.total_tables || 20}`}
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  min="1"
                  max={maxTableCount}
                  data-testid="checkin-table-input"
                  inputMode="numeric"
                  className={`${fieldBaseClass} rf-input-icon-left pr-4 rf-number-clean`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="checkin-verification-code" className="block text-[var(--rf-muted)] text-sm mb-2 font-bold uppercase tracking-[0.12em]">
                Masa Doğrulama Kodu (opsiyonel)
              </label>
              <input
                id="checkin-verification-code"
                type="text"
                placeholder="Konum alınamazsa personel kodunu girin"
                value={tableVerificationCode}
                onChange={(event) => setTableVerificationCode(event.target.value)}
                autoComplete="one-time-code"
                className={`${fieldBaseClass} px-4`}
              />
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void requestLocationAccess()}
                className="w-full py-3 font-semibold border-2 border-cyan-400/35 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-100 flex items-center justify-center gap-2 rf-control"
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
                  <span className="text-[var(--rf-muted)]">Devam etmek için konum izni verin</span>
                )}
              </div>

              <div className="p-3 bg-cyan-900/20 border border-cyan-700/30 text-center">
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
              className={`w-full py-4 font-bold text-white flex items-center justify-center gap-2 transition-all rf-control border-2 ${loading || !tableNumber
                ? 'bg-cyan-950/55 border-cyan-900/45 text-[var(--rf-muted)] cursor-not-allowed opacity-50'
                : 'bg-cyan-500 border-cyan-200 hover:bg-cyan-400 text-[#041226] shadow-[5px_5px_0_rgba(255,0,234,0.3)] hover:scale-[1.02] active:scale-95'
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
                  KAFEYE GİR & OYNA
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
