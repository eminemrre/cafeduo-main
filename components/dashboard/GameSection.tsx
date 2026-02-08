/**
 * GameSection Component
 * 
 * @description Oyun lobisi ve oyun kurma/katılma işlevselliği
 */

import React from 'react';
import { GameHistoryEntry, GameRequest, User } from '../../types';
import { GameLobby } from '../GameLobby';
import { CreateGameModal } from '../CreateGameModal';
import { RetroButton } from '../RetroButton';
import { Gamepad2, Users, Gamepad2 as GamepadIcon } from 'lucide-react';
import { SkeletonGrid } from '../Skeleton';
import { EmptyState } from '../EmptyState';

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
  onCreateGame: (gameType: string, points: number) => Promise<void>;
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
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded border ${
                      item.didWin
                        ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
                        : 'border-rose-400/35 bg-rose-500/10 text-rose-300'
                    }`}>
                      {item.didWin ? 'Kazandın' : 'Kaybettin'}
                    </span>
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
    </div>
  );
};

export default GameSection;
