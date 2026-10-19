/**
 * TournamentBanner — riso strip at the top of Dashboard.
 *
 * Shows the active tournament's name, a live countdown until end_at, and
 * a "Sıralama" CTA that opens the leaderboard modal. Designed to be the
 * loudest thing on the dashboard so checked-in users can't miss the event.
 */
import React, { useEffect, useState } from 'react';
import { Trophy, ArrowRight } from 'lucide-react';
import type { Tournament } from '../types';

const computeRemaining = (endAtIso: string): string => {
  const ms = new Date(endAtIso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
};

interface TournamentBannerProps {
  tournament: Tournament;
  onOpenLeaderboard: () => void;
}

export const TournamentBanner: React.FC<TournamentBannerProps> = ({
  tournament,
  onOpenLeaderboard,
}) => {
  const [remaining, setRemaining] = useState(() => computeRemaining(tournament.end_at));

  useEffect(() => {
    setRemaining(computeRemaining(tournament.end_at));
    const id = setInterval(() => {
      setRemaining(computeRemaining(tournament.end_at));
    }, 1000);
    return () => clearInterval(id);
  }, [tournament.end_at]);

  return (
    <div
      className="relative border-2 border-carbon bg-riso-mustard riso-shadow-md mb-6 overflow-hidden"
      data-testid="tournament-banner"
    >
      <div className="absolute top-0 left-0 h-1.5 w-full bg-riso-pink border-b-2 border-carbon" />
      <div className="flex items-center gap-3 sm:gap-4 px-3 py-2.5 sm:px-6 sm:py-4 mt-1.5">
        <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center border-2 border-carbon bg-paper text-carbon">
          <Trophy size={22} strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-riso-mono text-[0.65rem] uppercase tracking-[0.18em] text-carbon-soft">
            Aktif Turnuva · {tournament.game_type || 'Tüm oyunlar'}
          </p>
          <h3 className="font-riso-display text-sm sm:text-lg text-carbon truncate">
            {tournament.name}
          </h3>
          <p
            className="font-riso-mono text-xs font-bold text-carbon"
            aria-live="polite"
            data-testid="tournament-countdown"
          >
            Bitiş: <span className="text-riso-redox">{remaining}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenLeaderboard}
          data-testid="tournament-open-leaderboard"
          className="riso-focus shrink-0 inline-flex items-center gap-1.5 border-2 border-carbon bg-paper px-3 py-2 min-h-[44px] font-riso-display text-xs sm:text-sm font-bold uppercase tracking-wider text-carbon hover:bg-riso-pink hover:text-carbon transition-colors"
        >
          <span className="hidden sm:inline">Sıralama</span>
          <span className="sm:hidden">Sıra</span>
          <ArrowRight size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
