/**
 * Maç sonucu kartı (v2 dili, DESIGN.md): kazanınca fıstık alan, diğer
 * sonuçlarda buz zemin; köşeler kare, gölge ve çerçeve yok.
 *
 * Dashboard'daki ham sonuç banner'ının yerini alır: kazan/kaybet/berabere
 * ton sistemi, animasyonlu puan sayacı (0→+N) ve oyun istatistik chip'leri.
 * Backend'e dokunmaz — tüm veri oyun bileşenlerinden props ile gelir.
 *
 * Sentinel winner değerleri ('Berabere', 'Sonuç Bekleniyor') burada tanınır;
 * eskiden banner bunları kullanıcı adı sanıp "Berabere kazandı" yazıyordu.
 */
import React, { useEffect, useState } from 'react';
import { motion, animate, useReducedMotion } from 'framer-motion';
import { popIn, reducedFade } from '../ui/motionVariants';

/** Oyun bileşenlerinin maç bitiminde elinde olan, tamamı client-side istatistikler. */
export interface MatchStats {
  kind: 'chess' | 'quiz' | 'arena' | 'battleship' | 'hangman';
  /** Amiral Battı: ship cells hit (of 12). */
  playerScore?: number;
  opponentScore?: number;
  maxRounds?: number;
  /** Bilgi Yarışı: doğru cevap sayısı. */
  correctAnswers?: number;
  moveCount?: number;
  durationMs?: number;
}

interface MatchResultCardProps {
  winner: string;
  earnedPoints: number;
  stats?: MatchStats;
  currentUsername: string;
  onDismiss: () => void;
  dismissing: boolean;
}

/** Oyunların gönderdiği gerçek-kullanıcı-adı-olmayan sonuç değerleri. */
const SENTINEL_DRAW = 'berabere';
const SENTINEL_PENDING = 'sonuç bekleniyor';
const SENTINEL_CANCELLED = 'maç iptal edildi';

type Outcome = 'win' | 'lose' | 'draw' | 'pending' | 'cancelled';

const deriveOutcome = (winner: string, currentUsername: string): Outcome => {
  const w = winner.trim().toLowerCase();
  if (!w || w === SENTINEL_DRAW) return 'draw';
  if (w === SENTINEL_PENDING) return 'pending';
  if (w === SENTINEL_CANCELLED) return 'cancelled';
  return w === currentUsername.trim().toLowerCase() ? 'win' : 'lose';
};

/** Points and rewards are fıstık; every other outcome sits on the ice well. */
const SURFACE: Record<Outcome, string> = {
  win: 'bg-candy-fistik',
  lose: 'bg-paper-deep',
  draw: 'bg-paper-deep',
  pending: 'bg-paper-deep',
  cancelled: 'bg-paper-deep',
};

const formatDuration = (ms: number) => {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** 0'dan hedefe sayan puan göstergesi; reduced-motion'da direkt final değer. */
const AnimatedPoints: React.FC<{ value: number }> = ({ value }) => {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion || value === 0) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduceMotion]);

  return (
    <span className="font-candy-mono text-[40px] font-bold leading-none tracking-[-0.02em] text-carbon tabular-nums">
      {display > 0 ? `+${display}` : display}
    </span>
  );
};

const StatChip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span className="inline-flex items-center gap-1.5 bg-paper px-2.5 py-1 font-candy-mono text-sm text-carbon">
    <span className="text-carbon-muted">{label}</span>
    <span className="font-bold">{value}</span>
  </span>
);

export const MatchResultCard: React.FC<MatchResultCardProps> = ({
  winner,
  earnedPoints,
  stats,
  currentUsername,
  onDismiss,
  dismissing,
}) => {
  const reduceMotion = useReducedMotion();
  const outcome = deriveOutcome(winner, currentUsername);

  const title =
    outcome === 'win'
      ? 'KAZANDIN'
      : outcome === 'draw'
        ? 'BERABERE'
        : outcome === 'pending'
          ? 'SONUÇ BEKLENİYOR'
          : outcome === 'cancelled'
            ? 'MAÇ İPTAL EDİLDİ'
            : `${winner} kazandı`;

  const chips: Array<{ label: string; value: string }> = [];
  if (stats) {
    if (typeof stats.playerScore === 'number' && typeof stats.opponentScore === 'number') {
      chips.push({
        label: stats.kind === 'battleship' ? 'İsabet' : 'Skor',
        value: `${stats.playerScore}–${stats.opponentScore}`,
      });
    }
    if (stats.kind === 'quiz' && typeof stats.maxRounds === 'number') {
      chips.push(
        typeof stats.correctAnswers === 'number'
          ? { label: 'Doğru', value: `${stats.correctAnswers}/${stats.maxRounds}` }
          : { label: 'Soru', value: String(stats.maxRounds) }
      );
    }
    if (stats.kind === 'chess' && typeof stats.moveCount === 'number') {
      chips.push({ label: 'Hamle', value: String(stats.moveCount) });
    }
    if (typeof stats.durationMs === 'number' && stats.durationMs > 0) {
      chips.push({ label: 'Süre', value: formatDuration(stats.durationMs) });
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={reduceMotion ? reducedFade : popIn}
      className={`mb-6 p-5 text-carbon sm:p-6 ${SURFACE[outcome]}`}
      data-testid="match-result-card"
      aria-live="polite"
    >
      <p className="text-[15px] font-medium">Maç sonucu</p>
      <p className="mt-1 font-candy-display text-[40px] leading-[0.98] tracking-[-0.01em]">
        {/* The sentinel titles keep their capitals in the source; a winner's name keeps its own case. */}
        {title}
      </p>

      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <span className="text-[15px] text-carbon">Puan etkisi:</span>
        <AnimatedPoints value={earnedPoints} />
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <StatChip key={chip.label} label={chip.label} value={chip.value} />
          ))}
        </div>
      )}

      <div className="mt-5">
        {/* On the fıstık field the action is the ink rectangle; on ice it is lokum. */}
        <button
          type="button"
          onClick={onDismiss}
          disabled={dismissing}
          className={`duo-button duo-focus min-h-12 px-5 font-candy-body text-base font-semibold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
            outcome === 'win' ? 'bg-carbon text-paper' : 'bg-candy-lokum text-carbon'
          }`}
        >
          {dismissing ? 'Lobiye dönülüyor...' : 'Sonucu gördüm, lobiye dön'}
        </button>
      </div>
    </motion.div>
  );
};

export default MatchResultCard;
