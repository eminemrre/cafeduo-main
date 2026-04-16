/**
 * HistoryDetailModal Component
 *
 * @description Chess game history detail modal - extracted from GameSection
 */

import React from 'react';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cyber-dark/95 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden border-[3px] border-neon-blue bg-cyber-bg shadow-[16px_16px_0_rgba(0,243,255,0.2)]">
        <div className="px-6 py-4 border-b-[3px] border-neon-blue bg-neon-blue/10 flex items-center justify-between">
          <div>
            <h4 className="font-display text-2xl text-neon-blue uppercase tracking-widest">SİSTEM KAYDI #CHESS</h4>
            <p className="font-sans text-xs text-ink-200 mt-1 uppercase font-bold tracking-wider">
              HEDEF: {history.opponentName} // {new Date(history.createdAt).toLocaleString('tr-TR')}
            </p>
          </div>
          <button
            type="button"
            className="text-cyber-dark bg-neon-blue font-bold px-4 py-2 hover:bg-transparent hover:text-neon-blue border-[2px] border-neon-blue transition-colors uppercase tracking-widest text-sm"
            onClick={onClose}
          >
            KAPAT
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <p className="font-sans text-white uppercase tracking-widest animate-pulse">Veri deşifre ediliyor...</p>
          ) : error ? (
            <p className="font-sans text-neon-pink font-bold border-l-4 border-neon-pink pl-4 py-2 bg-neon-pink/10">{error}</p>
          ) : history.moves.length === 0 ? (
            <p className="font-sans text-ink-300 border border-dashed border-cyber-border p-4 text-center">ANOMALİ: LOKASYON VERİSİ YOK.</p>
          ) : (
            <ol className="space-y-1 font-mono text-sm max-w-md">
              {history.moves.map((move, index) => (
                <li
                  key={`${move.ts || ''}-${index}`}
                  className="border-b border-cyber-border/50 py-2 flex justify-between"
                >
                  <span className="text-neon-blue font-bold">
                    {(index + 1).toString().padStart(3, '0')}. <span className="text-ink-50">{move.san}</span> <span className="text-ink-300 text-xs">[{move.from}&rarr;{move.to}]</span>
                  </span>
                  <span className="text-ink-400">
                    {Number.isFinite(Number(move.spentMs))
                      ? `${(Number(move.spentMs) / 1000).toFixed(1)}s`
                      : '--'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryDetailModal;
