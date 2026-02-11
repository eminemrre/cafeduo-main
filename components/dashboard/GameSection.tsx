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
  onCancelGame = async () => {},
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
      <div className="rf-panel border-cyan-400/25 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">
              🎮 Aktif Oyunun Var!
            </h3>
            <p className="text-[var(--rf-muted)] text-sm">
              <span className="text-cyan-300 font-semibold">{opponentLabel}</span> ile 
              <span className="text-amber-300 font-semibold"> {serverActiveGame.gameType}</span> oyunun devam ediyor.
            </p>
          </div>
          <RetroButton onClick={onRejoinGame} variant="primary">
            Oyuna Dön
          </RetroButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <Gamepad2 className="text-cyan-300" size={32} />
            Oyun Lobisi
          </h2>
          <p className="text-[var(--rf-muted)] mt-1">
            {isMatched 
              ? `Masan: ${tableCode} - Rakiplerini bekle veya oyun kur!`
              : 'Oyun oynamak için önce bir masaya bağlanmalısın!'
            }
          </p>
        </div>
        
        <RetroButton
          onClick={() => setIsCreateModalOpen(true)}
          disabled={!isMatched}
          variant="primary"
          data-testid="create-game-button"
          className="w-full sm:w-auto"
        >
          <Users size={18} />
          Yeni Oyun Kur
        </RetroButton>
      </div>

      {/* Oyun Listesi */}
      {gamesLoading ? (
        <div data-testid="game-lobby-empty">
          <SkeletonGrid count={4} columns={2} />
        </div>
      ) : (games?.length ?? 0) === 0 ? (
        <div data-testid="game-lobby-empty">
          <EmptyState
            icon={GamepadIcon}
            title="Henüz Oyun Yok"
            description="Şu an lobide aktif bir oyun yok. İlk oyunu kuran sen ol!"
            action={{
              label: "Yeni Oyun Kur",
              onClick: () => setIsCreateModalOpen(true),
              icon: Users
            }}
          />
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

      {/* Oyun Geçmişi */}
      <div className="rf-panel border-cyan-400/20 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-cyan-400/20 bg-[#0a1732]/75">
          <h3 className="font-pixel text-white text-sm md:text-base tracking-wide">GEÇMİŞ OYUNLAR</h3>
        </div>

        <div className="p-4">
          {historyLoading ? (
            <p className="text-sm text-[var(--rf-muted)]">Geçmiş yükleniyor...</p>
          ) : (gameHistory?.length ?? 0) === 0 ? (
            <p className="text-sm text-[var(--rf-muted)]">
              Henüz tamamlanan oyunun yok. İlk oyunu bitirince burada görünecek.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {gameHistory.slice(0, 10).map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-cyan-400/15 bg-[#0a1631]/65 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{item.gameType}</p>
                    <p className="text-xs text-[var(--rf-muted)]">
                      Rakip: <span className="text-cyan-200">{item.opponentName}</span> · Masa {item.table}
                    </p>
                    {item.gameType === 'Retro Satranç' && (
                      <p className="text-xs text-cyan-300/85">
                        Tempo: {item.chessTempo || '-'} · Hamle: {item.moveCount ?? 0}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded border ${
                      item.didWin
                        ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
                        : 'border-rose-400/35 bg-rose-500/10 text-rose-300'
                    }`}>
                      {item.didWin ? 'Kazandın' : 'Kaybettin'}
                    </span>
                    {item.gameType === 'Retro Satranç' && (
                      <button
                        type="button"
                        onClick={() => void openHistoryDetail(item)}
                        className="px-2 py-1 rounded border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                      >
                        Hamleleri Gör
                      </button>
                    )}
                    <span className="text-[var(--rf-muted)]">{new Date(item.createdAt).toLocaleDateString('tr-TR')}</span>
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

      {selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl border border-cyan-400/30 bg-[linear-gradient(165deg,rgba(3,16,40,0.96),rgba(4,28,56,0.92))]">
            <div className="px-4 py-3 border-b border-cyan-400/20 flex items-center justify-between">
              <div>
                <h4 className="font-pixel text-white text-sm">SATRANÇ MAÇ KAYDI</h4>
                <p className="text-xs text-[var(--rf-muted)]">
                  {selectedHistory.opponentName} · {new Date(selectedHistory.createdAt).toLocaleString('tr-TR')} · Tempo {selectedHistory.chessTempo || '-'}
                </p>
              </div>
              <button
                type="button"
                className="text-[var(--rf-muted)] hover:text-white"
                onClick={() => setSelectedHistory(null)}
              >
                Kapat
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {historyDetailLoading ? (
                <p className="text-sm text-[var(--rf-muted)]">Hamle kaydı yükleniyor...</p>
              ) : historyDetailError ? (
                <p className="text-sm text-rose-300">{historyDetailError}</p>
              ) : selectedHistory.moves.length === 0 ? (
                <p className="text-sm text-[var(--rf-muted)]">Bu maç için hamle kaydı bulunamadı.</p>
              ) : (
                <ol className="space-y-2">
                  {selectedHistory.moves.map((move, index) => (
                    <li
                      key={`${move.ts || ''}-${index}`}
                      className="rounded border border-cyan-400/15 bg-[#0b1d3c]/70 px-3 py-2 text-sm flex items-center justify-between gap-3"
                    >
                      <span className="text-cyan-100">
                        {index + 1}. {move.san} ({move.from}→{move.to})
                      </span>
                      <span className="text-xs text-[var(--rf-muted)] whitespace-nowrap">
                        {Number.isFinite(Number(move.spentMs))
                          ? `${Math.round(Number(move.spentMs) / 1000)} sn`
                          : ''}
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
