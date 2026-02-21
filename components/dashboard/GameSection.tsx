/**
 * GameSection Component
 * 
 * @description Oyun lobisi ve oyun kurma/katılma işlevselliği
 */

import React, { useMemo, useState } from 'react';
import { GameHistoryEntry, GameRequest, User } from '../../types';
import { GameLobby } from '../GameLobby';
import { CreateGameModal } from '../CreateGameModal';
import { RetroButton } from '../RetroButton';
import { Gamepad2, Users, Gamepad2 as GamepadIcon } from 'lucide-react';
import { SkeletonGrid } from '../Skeleton';
import { EmptyState } from '../EmptyState';
import { api } from '../../lib/api';

interface GameSectionProps {
  // Kullanıcı
  currentUser: User;
  tableCode: string;
  isMatched: boolean;

  // Oyun listesi
  games: GameRequest[];
  gamesLoading: boolean;
  gameHistory?: GameHistoryEntry[];
  historyLoading?: boolean;

  // Aktif oyun
  activeGameId: string | number | null;
  serverActiveGame: GameRequest | null;

  // Modal state
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;

  // Handler'lar
  onCreateGame: (
    gameType: string,
    points: number,
    options?: { chessClock?: { baseSeconds: number; incrementSeconds: number; label: string } }
  ) => Promise<void>;
  onJoinGame: (gameId: number) => Promise<void>;
  onCancelGame?: (gameId: number | string) => Promise<void>;
  onViewProfile: (username: string) => void;
  onRejoinGame: () => void;
}

export const GameSection: React.FC<GameSectionProps> = ({
  currentUser,
  tableCode,
  isMatched,
  games,
  gamesLoading,
  gameHistory = [],
  historyLoading = false,
  activeGameId,
  serverActiveGame,
  isCreateModalOpen,
  setIsCreateModalOpen,
  onCreateGame,
  onJoinGame,
  onCancelGame = async () => { },
  onViewProfile,
  onRejoinGame
}) => {
  const [quickJoinBusy, setQuickJoinBusy] = useState(false);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [historyDetailError, setHistoryDetailError] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<{
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
  } | null>(null);
  const normalizedTable = String(tableCode || '').trim().toUpperCase();
  const currentUsername = String(currentUser?.username || '').trim().toLowerCase();

  const quickJoinCandidate = useMemo(() => {
    if (!Array.isArray(games) || games.length === 0) return null;
    const waiting = games.filter((game) => {
      return (
        String(game.status || '').toLowerCase() === 'waiting' &&
        String(game.hostName || '').toLowerCase() !== currentUsername
      );
    });
    if (waiting.length === 0) return null;

    const sameTable = waiting.find(
      (game) => String(game.table || '').trim().toUpperCase() === normalizedTable
    );
    return sameTable || waiting[0];
  }, [games, currentUsername, normalizedTable]);

  const handleQuickJoin = async () => {
    if (!quickJoinCandidate || !isMatched || quickJoinBusy) return;
    const quickJoinId = Number(quickJoinCandidate.id);
    if (!Number.isFinite(quickJoinId)) return;
    setQuickJoinBusy(true);
    try {
      await onJoinGame(quickJoinId);
    } finally {
      setQuickJoinBusy(false);
    }
  };

  const openHistoryDetail = async (entry: GameHistoryEntry) => {
    if (entry.gameType !== 'Retro Satranç') return;
    setHistoryDetailError(null);
    setHistoryDetailLoading(true);
    try {
      const game = await api.games.get(entry.id);
      const gameState = game?.gameState && typeof game.gameState === 'object' ? game.gameState as Record<string, unknown> : {};
      const chessState = gameState.chess && typeof gameState.chess === 'object' ? gameState.chess as Record<string, unknown> : {};
      const moveHistory = Array.isArray(chessState.moveHistory) ? chessState.moveHistory : [];
      const clockState = chessState.clock && typeof chessState.clock === 'object' ? chessState.clock as Record<string, unknown> : {};
      const baseMs = Number(clockState.baseMs);
      const incrementMs = Number(clockState.incrementMs);
      const tempo =
        Number.isFinite(baseMs) && Number.isFinite(incrementMs)
          ? `${Math.round(baseMs / 60000)}+${Math.round(incrementMs / 1000)}`
          : (entry.chessTempo || null);

      setSelectedHistory({
        id: entry.id,
        gameType: entry.gameType,
        opponentName: entry.opponentName,
        createdAt: entry.createdAt,
        winner: entry.winner,
        points: entry.points,
        chessTempo: tempo,
        moves: moveHistory as Array<{
          from: string;
          to: string;
          san: string;
          ts?: string;
          spentMs?: number;
          remainingMs?: number;
        }>,
      });
    } catch (err) {
      setHistoryDetailError(err instanceof Error ? err.message : 'Maç detayları alınamadı.');
    } finally {
      setHistoryDetailLoading(false);
    }
  };

  // Aktif oyun banner'ı göster
  if (serverActiveGame && !activeGameId) {
    const opponentLabel =
      serverActiveGame.hostName === currentUser.username
        ? serverActiveGame.guestName || 'Rakip'
        : serverActiveGame.hostName;

    return (
      <div className="bg-neon-pink text-cyber-dark p-6 mb-8 border-4 border-cyber-border shadow-[12px_12px_0_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[8px_8px_0_rgba(0,0,0,1)] transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-4xl uppercase tracking-widest mb-2 text-shadow-glitch">
              DEVAM EDEN SAVAŞ!
            </h3>
            <p className="font-sans font-bold text-lg">
              Sistem uyarısı: <span className="text-white underline">{opponentLabel}</span> ile olan
              <span className="text-white"> {serverActiveGame.gameType}</span> karşılaşması beklemede.
            </p>
          </div>
          <button
            onClick={onRejoinGame}
            className="px-8 py-4 bg-cyber-dark text-neon-pink font-display text-2xl uppercase border-2 border-cyber-dark hover:bg-transparent hover:text-cyber-dark hover:border-cyber-dark transition-colors"
          >
            ARENAYA DÖN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Oyun Lobisi */}
      <div>
        {gamesLoading ? (
          <div data-testid="game-lobby-empty">
            <SkeletonGrid count={4} columns={2} />
          </div>
        ) : (
          <div data-testid="game-lobby-list">
            <GameLobby
              requests={games}
              currentUser={currentUser}
              onJoinGame={onJoinGame}
              onCancelGame={onCancelGame}
              onCreateGameClick={() => setIsCreateModalOpen(true)}
              onQuickJoin={handleQuickJoin}
              quickJoinDisabled={!isMatched || !quickJoinCandidate || quickJoinBusy}
              quickJoinBusy={quickJoinBusy}
              onViewProfile={onViewProfile}
            />
          </div>
        )}
      </div>

      {/* Oyun Geçmişi (Brutalist) */}
      <div className="bg-cyber-dark border-[3px] border-cyber-border p-6 shadow-[8px_8px_0_rgba(0,243,255,0.2)]">
        <div className="border-b-[3px] border-cyber-border pb-4 mb-6 flex justify-between items-end">
          <h3 className="font-display text-4xl text-neon-blue uppercase tracking-widest">SAVAŞ ARŞİVİ</h3>
          <span className="text-neon-pink font-sans font-bold">// KAYITLAR</span>
        </div>

        <div>
          {historyLoading ? (
            <p className="text-lg font-sans text-ink-300 animate-pulse">Veri çekiliyor...</p>
          ) : (gameHistory?.length ?? 0) === 0 ? (
            <div className="border border-dashed border-cyber-border p-8 text-center text-ink-300 font-sans tracking-widest uppercase">
              SAVAŞ GEÇMİŞİ BULUNAMADI. <br />KANITLAR OLUŞTURULMALI.
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {gameHistory.slice(0, 10).map((item) => (
                <article
                  key={item.id}
                  className="bg-cyber-card border-l-4 border-y border-r border-cyber-border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-transform hover:translate-x-2"
                  style={{ borderLeftColor: item.didWin ? 'var(--color-neon-blue)' : 'var(--color-neon-pink)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-2xl text-ink-50 uppercase tracking-widest truncate mb-1">
                      {item.gameType}
                    </p>
                    <p className="font-sans text-sm text-ink-300 font-bold uppercase tracking-wide">
                      Rakip: <span className="text-white">{item.opponentName}</span> // Masa {item.table}
                    </p>
                    {item.gameType === 'Retro Satranç' && (
                      <p className="text-xs text-neon-blue font-sans mt-2">
                        Tempo: {item.chessTempo || '-'} | Hamle: {item.moveCount ?? 0}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col md:items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-4 py-1 text-xs font-bold uppercase tracking-widest border-2 ${item.didWin
                          ? 'bg-neon-blue text-cyber-dark border-neon-blue'
                          : 'bg-transparent text-neon-pink border-neon-pink'
                        }`}>
                        {item.didWin ? 'ZAFER' : 'MAĞLUBİYET'}
                      </span>
                      <span className="text-ink-300 font-sans text-xs border border-cyber-border px-2 py-1">
                        {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </div>

                    {item.gameType === 'Retro Satranç' && (
                      <button
                        type="button"
                        onClick={() => void openHistoryDetail(item)}
                        className="text-xs font-sans font-bold text-neon-blue hover:text-white transition-colors uppercase tracking-widest underline decoration-neon-blue decoration-2 underline-offset-4"
                      >
                        LOGLARI GÖSTER &rarr;
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Game Modal */}
      <CreateGameModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={onCreateGame}
        maxPoints={currentUser?.points ?? 0}
      />

      {/* History Detail Modal (Brutalist) */}
      {selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cyber-dark/95 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden border-[3px] border-neon-blue bg-cyber-bg shadow-[16px_16px_0_rgba(0,243,255,0.2)]">
            <div className="px-6 py-4 border-b-[3px] border-neon-blue bg-neon-blue/10 flex items-center justify-between">
              <div>
                <h4 className="font-display text-2xl text-neon-blue uppercase tracking-widest">SİSTEM KAYDI #CHESS</h4>
                <p className="font-sans text-xs text-ink-200 mt-1 uppercase font-bold tracking-wider">
                  HEDEF: {selectedHistory.opponentName} // {new Date(selectedHistory.createdAt).toLocaleString('tr-TR')}
                </p>
              </div>
              <button
                type="button"
                className="text-cyber-dark bg-neon-blue font-bold px-4 py-2 hover:bg-transparent hover:text-neon-blue border-[2px] border-neon-blue transition-colors uppercase tracking-widest text-sm"
                onClick={() => setSelectedHistory(null)}
              >
                KAPAT
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {historyDetailLoading ? (
                <p className="font-sans text-white uppercase tracking-widest animate-pulse">Veri deşifre ediliyor...</p>
              ) : historyDetailError ? (
                <p className="font-sans text-neon-pink font-bold border-l-4 border-neon-pink pl-4 py-2 bg-neon-pink/10">{historyDetailError}</p>
              ) : selectedHistory.moves.length === 0 ? (
                <p className="font-sans text-ink-300 border border-dashed border-cyber-border p-4 text-center">ANOMALİ: LOKASYON VERİSİ YOK.</p>
              ) : (
                <ol className="space-y-1 font-mono text-sm max-w-md">
                  {selectedHistory.moves.map((move, index) => (
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
      )}
    </div>
  );
};

export default GameSection;
