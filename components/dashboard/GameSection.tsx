/**
 * GameSection Component
 *
 * @description Oyun lobisi ve oyun kurma/katılma işlevselliği
 */

import React, { useMemo, useState } from 'react';
import { GameHistoryEntry, GameRequest, User } from '../../types';
import type { Tournament } from '../../types';
import { GameLobby } from '../GameLobby';
import { gameChipFill } from '../../lib/gameColors';
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
      <div className="duo-card bg-candy-lokum text-carbon p-5 sm:p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="duo-lobby-heading mb-2">Oyunun seni bekliyor.</h3>
            <p className="font-candy-body text-base text-carbon">
              <span className="font-bold underline">{opponentLabel}</span> ile olan
              <span className="font-bold"> {serverActiveGame.gameType}</span> karşılaşması
              beklemede.
            </p>
          </div>
          <button
            type="button"
            onClick={onRejoinGame}
            className="duo-button duo-focus shrink-0 min-h-12 px-5 bg-carbon text-paper font-candy-body text-base font-semibold transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
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
      <section aria-labelledby="duo-history-heading">
        <h3 id="duo-history-heading" className="duo-lobby-heading mb-5 text-carbon">
          Son oyunların
        </h3>

        {historyLoading ? (
          <p role="status" className="font-candy-body text-base text-carbon-muted">
            Oyun geçmişi yükleniyor...
          </p>
        ) : (gameHistory?.length ?? 0) === 0 ? (
          <p className="bg-paper-deep p-6 text-center text-sm leading-6 text-carbon-soft">
            İlk oyunundan sonra sonuçlarını burada görebilirsin.
          </p>
        ) : (
          <ol className="space-y-2">
            {gameHistory.slice(0, 10).map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 bg-paper-deep p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span
                      className={`inline-flex px-3 py-1 text-[15px] font-medium text-carbon ${gameChipFill(item.gameType)}`}
                    >
                      {item.gameType}
                    </span>
                    <span
                      className={`text-[15px] font-semibold ${item.didWin ? 'text-[#177A41]' : 'text-candy-danger'}`}
                    >
                      {item.didWin ? 'Kazandın' : 'Kaybettin'}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-candy-body text-sm text-carbon-soft">
                    Rakip: <span className="font-semibold text-carbon">{item.opponentName}</span>
                    {' · '}Masa {item.table}
                  </p>
                  {item.gameType === 'Retro Satranç' && (
                    <p className="mt-1 text-[13px] text-carbon-muted [font-variant-numeric:tabular-nums]">
                      Tempo: {item.chessTempo || '-'} · Hamle: {item.moveCount ?? 0}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 md:flex-col md:items-end md:gap-1">
                  <time
                    dateTime={item.createdAt}
                    className="text-[13px] text-carbon-muted [font-variant-numeric:tabular-nums]"
                  >
                    {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                  </time>
                  {item.gameType === 'Retro Satranç' && (
                    <button
                      type="button"
                      onClick={() => void openHistoryDetail(item)}
                      className="duo-quiet duo-focus"
                    >
                      Hamleleri incele
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

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
