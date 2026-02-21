/**
 * Dashboard Component (Refactored)
 * 
 * @description Ana dashboard container - sadece layout ve state dağıtımı
 * @version 2.0 - Custom hooks ile refactor edilmiş
 */

import React, { useEffect, useRef, useState } from 'react';
import { User, Reward } from '../types';
import { UserProfileModal } from './UserProfileModal';
import { ReflexRush } from './ReflexRush';
import { ArenaBattle } from './ArenaBattle';
import { TankBattle } from './TankBattle';
import { MemoryDuel } from './MemoryDuel';
import { OddEvenSprint } from './OddEvenSprint';
import { KnowledgeQuiz } from './KnowledgeQuiz';
import { RetroChess } from './RetroChess';
import { Leaderboard } from './Leaderboard';
import { Achievements } from './Achievements';
import { RetroButton } from './RetroButton';

// Hooks
import { useGames } from '../hooks/useGames';
import { useRewards } from '../hooks/useRewards';

// Sub-components
import { StatusBar } from './dashboard/StatusBar';
import { GameSection } from './dashboard/GameSection';
import { RewardSection } from './dashboard/RewardSection';

// Icons
import { Trophy, Gift, Gamepad2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';

interface DashboardProps {
  currentUser: User;
  onUpdateUser: (user: User) => void;
  onRefreshUser?: () => Promise<void> | void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, onUpdateUser, onRefreshUser }) => {
  const normalizeTableCode = (raw: unknown): string => {
    const value = String(raw || '').trim().toUpperCase();
    if (!value || value === 'NULL' || value === 'UNDEFINED') return '';
    return value.startsWith('MASA') ? value : `MASA${value.padStart(2, '0')}`;
  };

  // ==========================================
  // LOCAL STATE (Sadece UI state'leri)
  // ==========================================

  // Tab yönetimi
  const [mainTab, setMainTab] = useState<'games' | 'leaderboard' | 'achievements'>('games');

  // Masa kodu state
  const [tableCode, setTableCode] = useState(normalizeTableCode(currentUser.table_number));
  const [isMatched, setIsMatched] = useState(Boolean(currentUser.cafe_id) && Boolean(normalizeTableCode(currentUser.table_number)));

  // Modal state'leri
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [gameResult, setGameResult] = useState<{ winner: string; earnedPoints: number } | null>(null);
  const [leavingGame, setLeavingGame] = useState(false);
  const gameEndHandledRef = useRef(false);

  // ==========================================
  // CUSTOM HOOKS
  // ==========================================

  const {
    games,
    loading: gamesLoading,
    gameHistory,
    historyLoading,
    refetch,
    activeGameId,
    activeGameType,
    opponentName,
    isBot,
    serverActiveGame,
    createGame,
    joinGame,
    cancelGame,
    leaveGame,
    setActiveGame
  } = useGames({ currentUser, tableCode });

  const {
    rewards,
    rewardsLoading,
    inventory,
    inventoryLoading,
    activeTab: rewardTab,
    setActiveTab: setRewardTab,
    buyReward
  } = useRewards({ currentUser });

  useEffect(() => {
    const normalizedTable = normalizeTableCode(currentUser.table_number);
    setTableCode(normalizedTable);
    setIsMatched(Boolean(currentUser.cafe_id) && Boolean(normalizedTable));
  }, [currentUser.cafe_id, currentUser.table_number]);

  useEffect(() => {
    if (isProfileOpen && isOwnProfile) {
      setProfileUser(currentUser);
    }
  }, [currentUser, isOwnProfile, isProfileOpen]);

  useEffect(() => {
    if (!activeGameId) {
      setGameResult(null);
      setLeavingGame(false);
      gameEndHandledRef.current = false;
    }
  }, [activeGameId]);

  // ==========================================
  // HANDLER'LAR
  // ==========================================

  // Oyun kurma
  const handleCreateGame = async (
    gameType: string,
    points: number,
    options?: { chessClock?: { baseSeconds: number; incrementSeconds: number; label: string } }
  ) => {
    if (!isMatched) {
      alert('Oyun kurmak için önce bir masaya bağlanmalısın!');
      setIsCreateModalOpen(false);
      return;
    }

    try {
      await createGame(gameType, points, options);
      setIsCreateModalOpen(false);
    } catch (err) {
      alert('Oyun kurulurken hata oluştu.');
    }
  };

  // Oyuna katılma
  const handleJoinGame = async (gameId: number) => {
    if (!isMatched) {
      alert('Oyuna katılmak için önce bir masaya bağlanmalısın!');
      return;
    }

    try {
      await joinGame(gameId);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Oyuna katılırken hata oluştu.';
      alert(message);
    }
  };

  // Aktif oyuna geri dön
  const handleRejoinGame = () => {
    if (serverActiveGame) {
      const rejoinOpponent =
        serverActiveGame.hostName === currentUser.username
          ? serverActiveGame.guestName || 'Rakip'
          : serverActiveGame.hostName;

      setActiveGame(
        serverActiveGame.id,
        serverActiveGame.gameType,
        rejoinOpponent
      );
    }
  };

  // Ödül satın alma
  const handleBuyReward = async (reward: Reward) => {
    try {
      const result = await buyReward(reward);

      // Kullanıcı puanını güncelle
      onUpdateUser({
        ...currentUser,
        points: result.newPoints
      });

      alert(`${reward.title} satın alındı! Kupon kodu: ${result.code}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Satın alma başarısız.';
      alert(message);
    }
  };

  // Profil görüntüleme
  const handleViewProfile = (username: string) => {
    const isSelf = username.toLowerCase() === String(currentUser.username || '').toLowerCase();
    setIsOwnProfile(isSelf);
    setProfileUser(
      isSelf
        ? currentUser
        : ({ id: 0, username, email: '', points: 0, wins: 0, gamesPlayed: 0 } as User)
    );
    setIsProfileOpen(true);
  };

  const handleOpenOwnProfile = () => {
    setIsOwnProfile(true);
    setProfileUser(currentUser);
    setIsProfileOpen(true);
  };

  const handleSaveProfile = async (department: string) => {
    if (!isOwnProfile) return;
    const updatedUser = {
      ...currentUser,
      department,
    };
    await onUpdateUser(updatedUser);
    setProfileUser(updatedUser);
  };

  const handleCancelGame = async (gameId: number | string) => {
    try {
      await cancelGame(gameId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Oyun iptal edilirken hata oluştu.';
      alert(message);
    }
  };

  const resolveOpponentForForfeit = async (): Promise<string | null> => {
    if (opponentName && opponentName.trim()) {
      return opponentName.trim();
    }
    if (!activeGameId) return null;
    try {
      const liveGame = await api.games.get(activeGameId);
      const host = String(liveGame?.hostName || '').trim();
      const guest = String(liveGame?.guestName || '').trim();
      const actor = String(currentUser.username || '').trim().toLowerCase();
      if (host && host.toLowerCase() !== actor) return host;
      if (guest && guest.toLowerCase() !== actor) return guest;
      return null;
    } catch {
      return null;
    }
  };

  const performLeaveGame = async () => {
    if (leavingGame) return;
    setLeavingGame(true);
    try {
      const shouldApplyForfeit = Boolean(activeGameId) && !isBot && !gameResult;
      if (shouldApplyForfeit && activeGameId) {
        const winnerByForfeit = await resolveOpponentForForfeit();
        if (winnerByForfeit) {
          try {
            await api.games.finish(activeGameId, winnerByForfeit);
          } catch (err) {
            console.error('Forfeit finish request failed:', err);
          }
        }
      }
      leaveGame();
      setGameResult(null);
      await refetch();
      if (onRefreshUser) {
        await Promise.resolve(onRefreshUser());
      }
    } finally {
      setLeavingGame(false);
    }
  };

  const handleLeaveGame = () => {
    if (!gameResult) {
      const accepted = window.confirm('Oyundan çıkarsan mağlup sayılacaksın. Oyundan çıkmak istiyor musun?');
      if (!accepted) return;
    }
    void performLeaveGame();
  };

  // Manuel dönüş (istatistik işlemeden)
  const handleBackToLobby = () => {
    handleLeaveGame();
  };

  // Oyun sonu (istatistik + puan güncelleme)
  const handleGameFinish = (winner: string, earnedPoints: number) => {
    if (gameEndHandledRef.current) return;
    gameEndHandledRef.current = true;
    const safeEarnedPoints = Number.isFinite(earnedPoints) ? earnedPoints : 0;
    setGameResult((prev) => prev ?? { winner, earnedPoints: safeEarnedPoints });
    void refetch();
    if (onRefreshUser) {
      void onRefreshUser();
      return;
    }

    // Legacy fallback (test/mock environments)
    const didWin = winner === currentUser.username;
    onUpdateUser({
      ...currentUser,
      points: Math.max(0, (currentUser.points || 0) + safeEarnedPoints),
      wins: (currentUser.wins || 0) + (didWin ? 1 : 0),
      gamesPlayed: (currentUser.gamesPlayed || 0) + 1,
    });
  };

  // ==========================================
  // RENDER: Aktif Oyun Ekranı
  // ==========================================

  if (activeGameId) {
    return (
      <div className="min-h-screen rf-dashboard-shell text-[var(--rf-ink)] pt-[calc(6rem+env(safe-area-inset-top))] md:pt-24 pb-[calc(3rem+env(safe-area-inset-bottom))] px-4 relative overflow-hidden">
        <div className="absolute inset-0 rf-grid opacity-[0.06] pointer-events-none" />
        <div className="max-w-6xl mx-auto">
          {/* Geri butonu */}
          <div className="mb-6">
            <RetroButton onClick={handleBackToLobby} variant="secondary">
              ← Lobiye Dön
            </RetroButton>
          </div>

          {gameResult && (
            <div className="mb-6 rf-panel border-emerald-400/30 rounded-xl p-4">
              <p className="text-sm text-emerald-200">Maç Sonucu</p>
              <p className="text-lg font-bold text-white mt-1">
                {gameResult.winner ? `${gameResult.winner} kazandı` : 'Maç berabere bitti'}
              </p>
              <p className="text-sm text-[var(--rf-muted)] mt-1">
                Puan etkisi: {gameResult.earnedPoints > 0 ? `+${gameResult.earnedPoints}` : gameResult.earnedPoints}
              </p>
              <div className="mt-3">
                <RetroButton onClick={handleBackToLobby} variant="primary" disabled={leavingGame}>
                  {leavingGame ? 'Lobiye dönülüyor...' : 'Sonucu gördüm, lobiye dön'}
                </RetroButton>
              </div>
            </div>
          )}

          {/* Oyun component'leri */}
          {activeGameType === 'Retro Satranç' ? (
            <RetroChess
              gameId={activeGameId}
              currentUser={currentUser}
              opponentName={opponentName || 'Rakip'}
              isBot={isBot}
              onGameEnd={handleGameFinish}
              onLeave={handleLeaveGame}
            />
          ) : activeGameType === 'Refleks Avı' ? (
            <ReflexRush
              gameId={String(activeGameId)}
              currentUser={currentUser}
              opponentName={opponentName || 'Rakip'}
              isBot={isBot}
              onGameEnd={handleGameFinish}
              onLeave={handleLeaveGame}
            />
          ) : activeGameType === 'Bilgi Yarışı' ? (
            <KnowledgeQuiz
              gameId={activeGameId}
              currentUser={currentUser}
              opponentName={opponentName || 'Rakip'}
              isBot={isBot}
              onGameEnd={handleGameFinish}
              onLeave={handleLeaveGame}
            />
          ) : activeGameType === 'Nişancı Düellosu' ? (
            <ArenaBattle
              gameId={activeGameId}
              currentUser={currentUser}
              opponentName={opponentName || 'Rakip'}
              isBot={isBot}
              onGameEnd={handleGameFinish}
              onLeave={handleLeaveGame}
            />
          ) : activeGameType === 'Tank Düellosu' ? (
            <TankBattle
              gameId={activeGameId}
              currentUser={currentUser}
              opponentName={opponentName || 'Rakip'}
              isBot={isBot}
              onGameEnd={handleGameFinish}
              onLeave={handleLeaveGame}
            />
          ) : activeGameType === 'Neon Hafıza' ? (
            <MemoryDuel
              gameId={activeGameId}
              currentUser={currentUser}
              opponentName={opponentName || 'Rakip'}
              isBot={isBot}
              onGameEnd={handleGameFinish}
              onLeave={handleLeaveGame}
            />
          ) : activeGameType === 'Çift Tek Sprint' ? (
            <OddEvenSprint
              gameId={activeGameId}
              currentUser={currentUser}
              opponentName={opponentName || 'Rakip'}
              isBot={isBot}
              onGameEnd={handleGameFinish}
              onLeave={handleLeaveGame}
            />
          ) : (
            <ArenaBattle
              gameId={activeGameId}
              currentUser={currentUser}
              opponentName={opponentName || 'Rakip'}
              isBot={isBot}
              onGameEnd={handleGameFinish}
              onLeave={handleLeaveGame}
            />
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: Ana Dashboard
  // ==========================================

  return (
    <div className="min-h-screen rf-dashboard-shell text-[var(--rf-ink)] pt-[calc(6rem+env(safe-area-inset-top))] md:pt-24 pb-[calc(3rem+env(safe-area-inset-bottom))] px-4 relative overflow-hidden">
      <div className="absolute inset-0 rf-grid opacity-[0.06] pointer-events-none" />
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Status Bar */}
        <StatusBar
          user={currentUser}
          tableCode={tableCode}
          isMatched={isMatched}
          onOpenProfile={handleOpenOwnProfile}
        />

        {/* Main Navigation Tabs */}
        <div className="relative bg-cyber-dark border-4 border-cyber-border p-2 md:p-3 shadow-[8px_8px_0_rgba(0,243,255,0.15)] flex flex-col">
          <div className="flex items-center gap-2 md:gap-4">
            {[
              { id: 'games', label: 'OYUNLAR', mobileLabel: 'OYUN', icon: Gamepad2, hoverColor: 'hover:border-neon-blue hover:text-neon-blue', activeColor: 'border-neon-blue text-cyber-dark bg-neon-blue' },
              { id: 'leaderboard', label: 'SIRALAMA', mobileLabel: 'SIRA', icon: Trophy, hoverColor: 'hover:border-neon-pink hover:text-neon-pink', activeColor: 'border-neon-pink text-cyber-dark bg-neon-pink' },
              { id: 'achievements', label: 'BAŞARI', mobileLabel: 'BAŞARI', icon: Gift, hoverColor: 'hover:border-neon-green hover:text-neon-green', activeColor: 'border-neon-green text-cyber-dark bg-neon-green' }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = mainTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setMainTab(tab.id as typeof mainTab)}
                  data-testid={`dashboard-tab-${tab.id}`}
                  aria-label={tab.label}
                  className={`relative flex-1 flex items-center justify-center gap-2 md:gap-3 px-2 py-3 md:py-4 transition-all border-2 font-display uppercase tracking-widest text-lg md:text-xl
                    ${isActive ? tab.activeColor : `border-transparent text-ink-300 ${tab.hoverColor} bg-cyber-bg/50`}`}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2 min-w-0">
                    <Icon size={24} className={isActive ? '' : 'opacity-70'} />
                    <span className="hidden sm:inline truncate">{tab.label}</span>
                    <span className="sm:hidden max-[380px]:hidden truncate whitespace-nowrap">{tab.mobileLabel}</span>
                  </span>

                  {isActive && (
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-cyber-dark" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mainTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {mainTab === 'games' && (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.75fr)_minmax(340px,1fr)] 2xl:grid-cols-[minmax(0,1.9fr)_minmax(380px,1fr)] gap-6 md:gap-8">
                {/* Sol: Oyun Lobisi */}
                <div className="order-1 min-w-0">
                  <GameSection
                    currentUser={currentUser}
                    tableCode={tableCode}
                    isMatched={isMatched}
                    games={games}
                    gamesLoading={gamesLoading}
                    gameHistory={gameHistory}
                    historyLoading={historyLoading}
                    activeGameId={activeGameId}
                    serverActiveGame={serverActiveGame}
                    isCreateModalOpen={isCreateModalOpen}
                    setIsCreateModalOpen={setIsCreateModalOpen}
                    onCreateGame={handleCreateGame}
                    onJoinGame={handleJoinGame}
                    onCancelGame={handleCancelGame}
                    onViewProfile={handleViewProfile}
                    onRejoinGame={handleRejoinGame}
                  />
                </div>

                {/* Sağ: Mağaza & Envanter */}
                <div className="order-2 min-w-0">
                  <RewardSection
                    currentUser={currentUser}
                    rewards={rewards}
                    rewardsLoading={rewardsLoading}
                    inventory={inventory}
                    inventoryLoading={inventoryLoading}
                    activeTab={rewardTab}
                    onTabChange={setRewardTab}
                    onBuyReward={handleBuyReward}
                  />
                </div>
              </div>
            )}

            {mainTab === 'leaderboard' && (
              <Leaderboard />
            )}

            {mainTab === 'achievements' && (
              <Achievements userId={currentUser.id} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Profile Modal */}
        <UserProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          user={profileUser}
          isEditable={isOwnProfile}
          onSaveProfile={handleSaveProfile}
        />
      </div>
    </div>
  );
};

export default Dashboard;
