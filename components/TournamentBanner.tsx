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
    <div className="mb-6 bg-riso-mustard text-carbon" data-testid="tournament-banner">
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6">
        <Trophy size={24} strokeWidth={2.2} className="hidden shrink-0 sm:block" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-riso-body text-[1.0625rem] font-semibold leading-tight">
            {tournament.name}
          </h3>
          <p className="mt-1 text-[0.8125rem] [font-variant-numeric:tabular-nums]">
            {tournament.game_type || 'Tüm oyunlar'} ·{' '}
            <span aria-live="polite" data-testid="tournament-countdown">
              bitişe <strong className="font-semibold">{remaining}</strong>
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenLeaderboard}
          data-testid="tournament-open-leaderboard"
          className="riso-focus inline-flex min-h-11 shrink-0 items-center gap-2 bg-carbon px-4 text-[0.9375rem] font-semibold text-paper transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
        >
          Sıralama
          <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
