/**
 * HistoryDetailModal — a finished chess game's move list, read like the
 * order slip: `move ··· time` rows with dotted leaders (DESIGN.md v2).
 */

import React from 'react';
import { X } from 'lucide-react';
import { DialogLayer } from '../ui/DialogLayer';

interface HistoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: {
    id: string | number;
    gameType: string;
    opponentName: string;
    createdAt: string;
    winner: string | null;
    points: number;
    chessTempo: string | null;
    moves: Array<{
      from: string;
      to: string;
      san: string;
      ts?: string;
      spentMs?: number;
      remainingMs?: number;
    }>;
  } | null;
  loading: boolean;
  error: string | null;
}

export const HistoryDetailModal: React.FC<HistoryDetailModalProps> = ({
  isOpen,
  onClose,
  history,
  loading,
  error,
}) => {
  if (!isOpen || !history) return null;

  const playedAt = new Date(history.createdAt);
  const playedLabel = Number.isFinite(playedAt.getTime())
    ? playedAt.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  return (
    <DialogLayer open={isOpen} onClose={onClose} label="Hamle kaydı">
      <div className="duo-scope fixed inset-0 z-[115] flex items-center justify-center px-4 py-6">
        <div className="absolute inset-0 bg-carbon/80" onClick={onClose} aria-hidden="true" />
        <div className="duo-float relative z-10 flex max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col overflow-hidden bg-paper">
          <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5 pb-4">
            <div className="min-w-0">
              <span className="inline-flex bg-candy-gok px-3 py-1 text-[15px] font-medium text-carbon">
                {history.gameType}
              </span>
              <h4 className="mt-3 font-candy-display text-[28px] leading-none text-carbon">
                Hamle kaydı
              </h4>
              <p className="mt-1.5 truncate text-[13px] text-carbon-soft">
                Rakip: <span className="font-semibold text-carbon">{history.opponentName}</span>
                {playedLabel ? ` · ${playedLabel}` : ''}
              </p>
            </div>
            <button
              type="button"
              aria-label="Kapat"
              className="duo-focus inline-flex h-11 w-11 shrink-0 items-center justify-center bg-paper-deep text-carbon transition-colors hover:bg-carbon hover:text-paper"
              onClick={onClose}
            >
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain border-t-[3px] border-dotted border-carbon/35 px-5 py-4">
            {loading ? (
              <p role="status" className="font-candy-body text-sm text-carbon-soft">
                Hamleler yükleniyor…
              </p>
            ) : error ? (
              <p role="alert" className="bg-candy-danger/10 px-3 py-2 font-candy-body text-sm text-carbon">
                {error}
              </p>
            ) : history.moves.length === 0 ? (
              <p className="bg-paper-deep p-4 text-center text-sm text-carbon-soft">
                Bu oyunun hamle kaydı yok.
              </p>
            ) : (
              <ol className="text-[15px] text-carbon">
                {history.moves.map((move, index) => (
                  <li key={`${move.ts || ''}-${index}`} className="duo-leader-row">
                    <span className="w-9 shrink-0 text-[13px] text-carbon-muted [font-variant-numeric:tabular-nums]">
                      {index + 1}.
                    </span>
                    <span className="font-semibold">{move.san}</span>
                    <span className="text-[13px] text-carbon-muted">
                      {move.from}–{move.to}
                    </span>
                    <span className="duo-leader-dots" aria-hidden="true" />
                    <span className="duo-leader-value text-[13px] text-carbon-soft">
                      {Number.isFinite(Number(move.spentMs))
                        ? `${(Number(move.spentMs) / 1000).toFixed(1)} sn`
                        : '–'}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </DialogLayer>
  );
};

export default HistoryDetailModal;
