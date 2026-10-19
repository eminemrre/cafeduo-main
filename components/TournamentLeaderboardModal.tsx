/**
 * TournamentLeaderboardModal — top-20 with avatars + cumulative points and
 * prize-tier icons next to ranks 1..N.
 *
 * Fetches on open + every 15s while mounted so the rankings stay live as
 * players score. The endpoint is cached server-side at 15s and busted on
 * every settlement, so we'd see new scores in at most ~30s worst case.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trophy, Medal } from 'lucide-react';
import { api } from '../lib/api';
import { AvatarImage } from './ui/AvatarImage';
import type { Tournament, TournamentLeaderboardResponse } from '../types';

const POLL_MS = 15_000;

/**
 * Format NUMERIC tournament points sent over the wire as string ("5.50",
 * "1.00", "0.50"). Show integers without decimals, halves with one digit.
 */
const formatPoints = (raw: number | string | null | undefined): string => {
  if (raw === null || raw === undefined) return '0';
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return '0';
  return n % 1 === 0 ? String(Math.trunc(n)) : n.toFixed(1);
};

interface TournamentLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  rewardLookup?: Map<number, { title: string; icon?: string }>;
}

export const TournamentLeaderboardModal: React.FC<TournamentLeaderboardModalProps> = ({
  isOpen,
  onClose,
  tournament,
  rewardLookup,
}) => {
  const [data, setData] = useState<TournamentLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Lock body scroll while the modal is open so the background page
    // doesn't scroll behind the leaderboard list.
    if (typeof document === 'undefined') return undefined;
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.tournaments.leaderboard(tournament.id);
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Sıralama yüklenemedi.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isOpen, tournament.id]);

  if (!isOpen) return null;

  // Build rank → prize lookup so we can flag the top-N rows.
  const prizeByRank = new Map<number, string>();
  for (const tier of tournament.prize_tiers) {
    const rewardTitle = rewardLookup?.get(tier.reward_id)?.title;
    prizeByRank.set(tier.rank, rewardTitle || `Ödül #${tier.reward_id}`);
  }

  // Render via portal to document.body so transformed/filtered ancestors
  // on Dashboard can't shift `position: fixed` relative to themselves.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="riso-kantin fixed inset-0 z-[120] flex items-center justify-center px-3 py-4 sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Turnuva sıralaması"
    >
      <div className="absolute inset-0 bg-carbon/80" onClick={onClose} aria-hidden="true" />

      <div className="duo-float relative z-10 w-full max-w-lg bg-paper max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b-[3px] border-dotted border-carbon/35 px-5 pt-5 pb-4 shrink-0">
          <div className="min-w-0">
            <h3 className="font-riso-display text-[1.75rem] leading-none text-carbon truncate">
              {tournament.name}
            </h3>
            <p className="mt-1.5 text-[0.8125rem] text-carbon-soft">Turnuva sıralaması</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="riso-focus inline-flex h-11 w-11 shrink-0 items-center justify-center bg-paper-deep text-carbon hover:bg-carbon hover:text-paper transition-colors"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto">
          {loading && !data ? (
            <p role="status" className="font-riso-body text-carbon-soft">Yükleniyor...</p>
          ) : error ? (
            <p role="alert" className="bg-riso-redox/10 px-3 py-2 font-riso-body text-sm text-carbon">{error}</p>
          ) : !data || data.leaderboard.length === 0 ? (
            <p className="bg-paper-deep p-4 font-riso-body text-sm text-carbon-soft">
              Henüz oynayan olmadı. Bir oyun bitince burada görüneceksin.
            </p>
          ) : (
            <ol className="space-y-2" data-testid="tournament-leaderboard">
              {data.leaderboard.map((row, idx) => {
                const rank = idx + 1;
                const prize = prizeByRank.get(rank);
                return (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 bg-paper-deep p-3"
                    data-testid={`tournament-leaderboard-row-${row.id}`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center text-sm font-semibold text-carbon [font-variant-numeric:tabular-nums] ${
                        rank === 1 ? 'bg-riso-mustard' : 'bg-paper'
                      }`}
                    >
                      {rank === 1 ? (
                        <Trophy size={16} strokeWidth={2.4} aria-label="Birinci" />
                      ) : rank <= 3 ? (
                        <Medal size={14} strokeWidth={2.4} />
                      ) : (
                        rank
                      )}
                    </div>
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden bg-riso-blue text-carbon">
                      <AvatarImage
                        src={row.avatar_url}
                        initials={String(row.username || '?')
                          .substring(0, 2)
                          .toUpperCase()}
                        initialsClassName="font-riso-body text-[13px] font-semibold"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-riso-body font-semibold text-carbon truncate">
                        {row.username}
                      </p>
                      {prize && (
                        <p className="text-[0.8125rem] text-carbon-soft">
                          Ödül: {prize}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-carbon [font-variant-numeric:tabular-nums]">
                        {formatPoints(row.total_points)}
                      </p>
                      <p className="text-[0.8125rem] text-carbon-soft">
                        {row.games_counted} oyun
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
