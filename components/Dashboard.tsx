/**
 * Dashboard Component (Refactored)
 * 
 * @description Ana dashboard container - sadece layout ve state dağıtımı
 * @version 2.0 - Custom hooks ile refactor edilmiş
 */

import React, { useEffect, useState } from 'react';
import { User, Reward } from '../types';
import { UserProfileModal } from './UserProfileModal';
import { ReflexRush } from './ReflexRush';
import { ArenaBattle } from './ArenaBattle';
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

interface DashboardProps {
  currentUser: User;
  onUpdateUser: (user: User) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, onUpdateUser }) => {
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

  // ==========================================
  // HANDLER'LAR
  // ==========================================

  // Oyun kurma
  const handleCreateGame = async (gameType: string, points: number) => {
    if (!isMatched) {
      alert('Oyun kurmak için önce bir masaya bağlanmalısın!');
      setIsCreateModalOpen(false);
      return;
    }

    try {
      await createGame(gameType, points);
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

  const handleLeaveGame = () => {
    leaveGame();
    void refetch();
  };

  // Manuel dönüş (istatistik işlemeden)
  const handleBackToLobby = () => {
    leaveGame();
    void refetch();
  };

  // Oyun sonu (istatistik + puan güncelleme)
  const handleGameFinish = (winner: string, earnedPoints: number) => {
    const didWin = winner === currentUser.username;
    const safeEarnedPoints = Number.isFinite(earnedPoints) ? Math.max(0, earnedPoints) : 0;

    const updatedUser = {
      ...currentUser,
      points: (currentUser.points || 0) + safeEarnedPoints,
      wins: (currentUser.wins || 0) + (didWin ? 1 : 0),
      gamesPlayed: (currentUser.gamesPlayed || 0) + 1,
    };

    onUpdateUser(updatedUser);
    leaveGame();
  };

  // ==========================================
  // RENDER: Aktif Oyun Ekranı
  // ==========================================
  
  if (activeGameId) {
    return (
      <div className="min-h-screen rf-dashboard-shell text-[var(--rf-ink)] pt-[calc(6rem+env(safe-area-inset-top))] md:pt-24 pb-12 px-4 relative overflow-hidden">
        <div className="absolute inset-0 rf-grid opacity-[0.06] pointer-events-none" />
        <div className="max-w-6xl mx-auto">
          {/* Geri butonu */}
          <div className="mb-6">
            <RetroButton onClick={handleBackToLobby} variant="secondary">
              ← Lobiye Dön
            </RetroButton>
          </div>

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
          ) : activeGameType === 'Tank Düellosu' ? (
            <ArenaBattle
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
    <div className="min-h-screen rf-dashboard-shell text-[var(--rf-ink)] pt-[calc(6rem+env(safe-area-inset-top))] md:pt-24 pb-12 px-4 relative overflow-hidden">
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
        <div className="relative rf-panel p-1.5 md:p-2 rounded-xl border-cyan-400/20">
          <div className="flex items-center gap-1 md:gap-2">
            {[
              { id: 'games', label: 'Oyunlar', mobileLabel: 'Oyun', icon: Gamepad2, color: 'cyan' },
              { id: 'leaderboard', label: 'Sıralama', mobileLabel: 'Sıra', icon: Trophy, color: 'amber' },
              { id: 'achievements', label: 'Başarımlar', mobileLabel: 'Başarı', icon: Gift, color: 'slate' }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = mainTab === tab.id;
              
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setMainTab(tab.id as typeof mainTab)}
                  data-testid={`dashboard-tab-${tab.id}`}
                  aria-label={tab.label}
                  className={`rf-tab-button relative flex-1 min-w-0 flex items-center justify-center gap-1 md:gap-2 px-2 md:px-6 py-2.5 md:py-3 rounded-lg font-medium text-[11px] sm:text-sm md:text-base ${
                    isActive ? 'rf-tab-active' : ''
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className={`absolute inset-0 rounded-lg border ${
                        tab.color === 'cyan'
                          ? 'bg-[#0d2a4b] border-cyan-300/35'
                          : tab.color === 'amber'
                            ? 'bg-[#3a2e20] border-amber-300/35'
                            : 'bg-[#232b3b] border-slate-300/20'
                      }`}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1 md:gap-2 min-w-0">
                    <Icon size={16} className="md:w-5 md:h-5 shrink-0" />
                    <span className="hidden sm:inline truncate">{tab.label}</span>
                    <span className="sm:hidden truncate whitespace-nowrap">{tab.mobileLabel}</span>
                  </span>
                </motion.button>
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
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.85fr)_minmax(420px,1fr)] 2xl:grid-cols-[minmax(0,2fr)_minmax(460px,1fr)] gap-6 md:gap-8">
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
