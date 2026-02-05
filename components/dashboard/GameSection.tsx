/**
 * GameSection Component
 * 
 * @description Oyun lobisi ve oyun kurma/katılma işlevselliği
 */

import React from 'react';
import { GameRequest, User } from '../../types';
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
  
  // Aktif oyun
  activeGameId: string | number | null;
  serverActiveGame: GameRequest | null;
  
  // Modal state
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  
  // Handler'lar
  onCreateGame: (gameType: string, points: number) => Promise<void>;
  onJoinGame: (gameId: number) => Promise<void>;
  onViewProfile: (username: string) => void;
  onRejoinGame: () => void;
}

export const GameSection: React.FC<GameSectionProps> = ({
  currentUser,
  tableCode,
  isMatched,
  games,
  gamesLoading,
  activeGameId,
  serverActiveGame,
  isCreateModalOpen,
  setIsCreateModalOpen,
  onCreateGame,
  onJoinGame,
  onViewProfile,
  onRejoinGame
}) => {
  // Aktif oyun banner'ı göster
  if (serverActiveGame && !activeGameId) {
    return (
      <div className="bg-[#151921] border border-blue-500/30 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">
              🎮 Aktif Oyunun Var!
            </h3>
            <p className="text-gray-400 text-sm">
              <span className="text-blue-400 font-semibold">{serverActiveGame.hostName}</span> ile 
              <span className="text-yellow-400 font-semibold"> {serverActiveGame.gameType}</span> oyunun devam ediyor.
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
            <Gamepad2 className="text-blue-500" size={32} />
            Oyun Lobisi
          </h2>
          <p className="text-gray-400 mt-1">
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
        <SkeletonGrid count={4} columns={2} />
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
            onCreateGameClick={() => setIsCreateModalOpen(true)}
            onViewProfile={onViewProfile}
          />
        </div>
      )}

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
