/**
 * GameSection Component
 *
 * @description Oyun lobisi ve oyun kurma/katılma işlevselliği
 */

import React, { useMemo, useState } from 'react';
import { GameHistoryEntry, GameRequest, User } from '../../types';
import type { Tournament } from '../../types';
import { GameLobby } from '../GameLobby';
import { CreateGameModal } from '../CreateGameModal';
import { SkeletonGrid } from '../Skeleton';
import { api } from '../../lib/api';
import { HistoryDetailModal } from './HistoryDetailModal';

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
    options?: {
      chessClock?: { baseSeconds: number; incrementSeconds: number; label: string };
      tournamentId?: number | null;
    }
  ) => Promise<void>;
  activeTournament?: Tournament | null;
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
  onCancelGame = async () => {},
  onViewProfile,
  onRejoinGame,
  activeTournament = null,
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
  const normalizedTable = String(tableCode || '')
    .trim()
    .toUpperCase();
  const currentUsername = String(currentUser?.username || '')
    .trim()
    .toLowerCase();

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
      (game) =>
        String(game.table || '')
          .trim()
          .toUpperCase() === normalizedTable
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
    setSelectedHistory({
      id: entry.id,
      gameType: entry.gameType,
      opponentName: entry.opponentName,
      createdAt: entry.createdAt,
      winner: entry.winner,
      points: entry.points,
      chessTempo: entry.chessTempo || null,
      moves: [],
    });
    setHistoryDetailLoading(true);
    try {
      const game = await api.games.get(entry.id);
      const gameState =
        game?.gameState && typeof game.gameState === 'object'
          ? (game.gameState as Record<string, unknown>)
          : {};
      const chessState =
        gameState.chess && typeof gameState.chess === 'object'
          ? (gameState.chess as Record<string, unknown>)
          : {};
      const moveHistory = Array.isArray(chessState.moveHistory) ? chessState.moveHistory : [];
      const clockState =
        chessState.clock && typeof chessState.clock === 'object'
          ? (chessState.clock as Record<string, unknown>)
          : {};
      const baseMs = Number(clockState.baseMs);
      const incrementMs = Number(clockState.incrementMs);
      const tempo =
        Number.isFinite(baseMs) && Number.isFinite(incrementMs)
          ? `${Math.round(baseMs / 60000)}+${Math.round(incrementMs / 1000)}`
          : entry.chessTempo || null;

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
      <div className="duo-card bg-riso-pink text-carbon p-5 sm:p-6 mb-8 border border-carbon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="duo-lobby-heading mb-2">Oyunun seni bekliyor.</h3>
            <p className="font-riso-body text-base text-carbon">
              <span className="font-bold underline">{opponentLabel}</span> ile olan
              <span className="font-bold"> {serverActiveGame.gameType}</span> karşılaşması
              beklemede.
            </p>
          </div>
          <button
            onClick={onRejoinGame}
            className="duo-button riso-focus shrink-0 px-5 py-3 bg-paper text-carbon font-riso-display text-lg sm:text-xl uppercase border-2 border-carbon riso-shadow-sm transition-all"
          >
            Oyuna dön
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

      {/* Oyun Geçmişi */}
      <div className="duo-card bg-paper border border-carbon/20 p-5 sm:p-6">
        <div className="border-b border-carbon/20 pb-4 mb-5 flex justify-between items-end">
          <h3 className="duo-lobby-heading text-carbon">Son oyunların</h3>
          <span className="font-riso-mono text-xs font-bold text-riso-pink-deep">Geçmiş</span>
        </div>

        <div>
          {historyLoading ? (
            <p className="text-base font-riso-body text-carbon-muted animate-pulse">
              Oyun geçmişi yükleniyor...
            </p>
          ) : (gameHistory?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-carbon/20 bg-paper-deep p-6 text-center text-sm leading-6 text-carbon-muted">
              İlk oyunundan sonra sonuçlarını burada görebilirsin.
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {gameHistory.slice(0, 10).map((item) => (
                <article
                  key={item.id}
                  className="bg-paper border-l-4 border-y border-r border-carbon p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-transform hover:translate-x-2"
                  style={{
                    borderLeftColor: item.didWin ? '#5BC25A' : '#FF3E94',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-riso-display text-2xl text-carbon uppercase tracking-widest truncate mb-1">
                      {item.gameType}
                    </p>
                    <p className="font-riso-body text-sm text-carbon-soft font-bold uppercase tracking-wide">
                      Rakip: <span className="text-carbon font-semibold">{item.opponentName}</span>{' '}
                      // Masa {item.table}
                    </p>
                    {item.gameType === 'Retro Satranç' && (
                      <p className="text-xs text-riso-blue font-riso-mono mt-2">
                        Tempo: {item.chessTempo || '-'} | Hamle: {item.moveCount ?? 0}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col md:items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 font-riso-mono text-xs font-bold uppercase tracking-wider border-2 border-carbon ${
                          item.didWin ? 'bg-riso-blue text-paper' : 'bg-paper text-riso-pink-deep'
                        }`}
                      >
                        {item.didWin ? 'ZAFER' : 'MAĞLUBİYET'}
                      </span>
                      <span className="font-riso-mono text-xs text-carbon-soft border-2 border-carbon bg-paper px-2 py-1">
                        {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </div>

                    {item.gameType === 'Retro Satranç' && (
                      <button
                        type="button"
                        onClick={() => void openHistoryDetail(item)}
                        className="text-xs font-riso-body font-bold text-riso-blue hover:text-riso-pink-deep transition-colors uppercase tracking-widest underline decoration-riso-blue decoration-2 underline-offset-4"
                      >
                        Hamleleri incele &rarr;
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
        activeTournament={activeTournament}
      />

      {/* History Detail Modal */}
      <HistoryDetailModal
        isOpen={selectedHistory !== null}
        onClose={() => setSelectedHistory(null)}
        history={selectedHistory}
        loading={historyDetailLoading}
        error={historyDetailError}
      />
    </div>
  );
};

export default GameSection;
