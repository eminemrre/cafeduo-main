/**
 * CafeSelection — cafe/table verification before entering the game dashboard.
 *
 * The first big surface a user hits after login. Hosts the GPS check-in flow
 * (cafe picker + table number + optional verification code).
 *
 * `data-testid` attributes preserved so existing tests still pass.
 */

import React from 'react';
import {
  MapPin,
  AlertTriangle,
  CheckCircle,
  LocateFixed,
  Coffee,
  Hash,
  KeyRound,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { User } from '../types';
import { useCafeSelection } from '../hooks/useCafeSelection';
import { Card, Button, Input, Select, Squiggle } from './ui';

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

  const [hasSubmitted, setHasSubmitted] = React.useState(false);
  const [showVerificationField, setShowVerificationField] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();

  const locationLabel = (() => {
    if (tableVerificationCode.trim()) {
      return {
        color: 'text-riso-blue',
        icon: <KeyRound size={14} />,
        text: 'Masa koduyla doğrulanacak',
      };
    }
    switch (locationStatus) {
      case 'ready':
        return {
          color: 'text-riso-spring',
          icon: <CheckCircle size={14} />,
          text: 'Konum alındı',
        };
      case 'requesting':
        return {
          color: 'text-riso-blue',
          icon: <LocateFixed size={14} className="animate-pulse" />,
          text: 'Konum alınıyor...',
        };
      case 'denied':
        return {
          color: 'text-riso-redox',
          icon: <AlertTriangle size={14} />,
          text: 'Konum alınamadı',
        };
      default:
        return { color: 'text-carbon-muted', icon: <MapPin size={14} />, text: 'Konum bekleniyor' };
    }
  })();

  const cafeOptions = React.useMemo(
    () => cafes.map((c) => ({ value: String(c.id), label: c.name })),
    [cafes]
  );

  return (
    <div
      className="duo-checkin riso-kantin-app relative min-h-screen overflow-hidden px-4"
      data-testid="cafe-selection-shell"
    >
      {/* Decorative riso confetti — subtle, behind everything */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[18%] h-3 w-3 bg-riso-pink riso-tilt-right" />
        <div className="absolute left-[80%] top-[12%] h-2 w-6 bg-riso-blue riso-tilt-left" />
        <div className="absolute left-[20%] top-[80%] h-4 w-4 bg-riso-mustard rounded-full" />
        <div className="absolute left-[88%] top-[68%] h-2 w-2 bg-riso-pink rounded-full" />
        <div className="absolute left-[5%] top-[55%] h-3 w-3 bg-riso-blue rounded-full" />
      </div>

      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: 'easeOut' }}
          className="mb-8 text-center"
        >
          <p className="mb-3 inline-block font-riso-mono text-xs uppercase tracking-[0.18em] text-carbon-soft">
            Oyuna bir adım kaldı
          </p>
          <h1 className="duo-checkin-heading mb-2 inline-block font-riso-display text-carbon">
            Kafeye Giriş
          </h1>
          <p className="mt-3 text-sm text-carbon-muted">
            Hangi masadasın? Konumun veya masa kodunla oyuna katıl.
          </p>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.5,
            ease: 'easeOut',
            delay: shouldReduceMotion ? 0 : 0.1,
          }}
        >
          <Card tone="paper" shadow="md" halftone={false} data-testid="cafe-selection-card">
            {/* Error banner */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                data-testid="cafe-selection-error"
                className="mb-5 border-2 border-riso-redox bg-paper p-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-riso-redox" />
                  <div className="min-w-0">
                    <p className="font-riso-display text-sm font-bold uppercase tracking-wider text-riso-redox">
                      Giriş Başarısız
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-carbon">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <form
              className="space-y-5"
              aria-busy={loading}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                setHasSubmitted(true);
                void checkIn();
              }}
            >
              <Select
                label="Kafe Seçimi"
                value={selectedCafeId || ''}
                onChange={(e) => setSelectedCafeId(e.target.value)}
                options={cafeOptions}
                data-testid="checkin-cafe-select"
                disabled={loading || cafes.length === 0}
              />

              <Input
                label="Masa Numarası"
                type="number"
                inputMode="numeric"
                icon={<Hash size={16} />}
                placeholder={`1 - ${selectedCafe?.table_count || selectedCafe?.total_tables || 20}`}
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                min={1}
                max={maxTableCount}
                disabled={loading}
                data-testid="checkin-table-input"
              />

              {/* Verification code — collapsed by default, toggle reveals it. */}
              {!showVerificationField && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowVerificationField(true)}
                  className="riso-focus inline-flex w-full items-center justify-between gap-2 border-2 border-dashed border-carbon-muted bg-paper-deep px-3 py-2.5 text-left text-sm font-medium text-carbon hover:border-carbon hover:bg-paper-dim transition-colors"
                  data-testid="checkin-show-verification"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound size={14} />
                    Konum vermek istemiyorsan: masa doğrulama kodu kullan
                  </span>
                  <span aria-hidden="true">+</span>
                </button>
              )}

              {showVerificationField && (
                <Input
                  id="checkin-verification-code"
                  data-testid="checkin-verification-input"
                  label="Masa Doğrulama Kodu"
                  type="text"
                  icon={<KeyRound size={16} />}
                  placeholder="Personelden alacağın kod"
                  value={tableVerificationCode}
                  onChange={(e) => setTableVerificationCode(e.target.value)}
                  autoComplete="one-time-code"
                  autoFocus
                  disabled={loading}
                  helperText="Konum izni vermek istemezsen bu kodla devam edebilirsin."
                />
              )}

              <Button
                tone="blue"
                size="md"
                block
                disabled={loading || locationStatus === 'requesting'}
                onClick={() => void requestLocationAccess()}
                onFocus={clearError}
                leadingIcon={<LocateFixed size={18} />}
              >
                Konumu Doğrula
              </Button>

              {/* Location status indicator */}
              <div
                role="status"
                className={`flex items-center justify-center gap-2 text-sm font-medium ${locationLabel.color}`}
              >
                {locationLabel.icon}
                <span>{locationLabel.text}</span>
              </div>

              <div className="border-2 border-dashed border-carbon-muted bg-paper-deep p-3 text-center">
                <p className="text-xs leading-relaxed text-carbon-muted">
                  Konum izni yalnızca kafe doğrulaması için kullanılır. Hiçbir yere kaydedilmez.
                </p>
              </div>

              <Button
                type="submit"
                tone="pink"
                size="lg"
                block
                disabled={loading || !tableNumber}
                data-testid="checkin-submit-button"
                leadingIcon={
                  loading ? (
                    <span className="h-4 w-4 animate-spin border-2 border-carbon/30 border-t-carbon rounded-full" />
                  ) : (
                    <Coffee size={20} />
                  )
                }
              >
                {loading ? 'Doğrulanıyor...' : 'Kafeye Gir & Oyna'}
              </Button>
            </form>
          </Card>
        </motion.div>

        {/* Squiggle decoration under the card */}
        <div className="mx-auto mt-6 w-32 opacity-60">
          <Squiggle tone="blue" />
        </div>

        {/* Re-render trigger to avoid unused warning */}
        <span className="sr-only" data-submitted={hasSubmitted ? 'true' : 'false'} />
      </div>
    </div>
  );
};
