/**
 * Dashboard Component (Refactored)
 * 
 * @description Ana dashboard container - sadece layout ve state dağıtımı
 * @version 2.0 - Custom hooks ile refactor edilmiş
 */

import React, { useState } from 'react';
import { User } from '../types';
import { UserProfileModal } from './UserProfileModal';
import { RockPaperScissors } from './RockPaperScissors';
import { ArenaBattle } from './ArenaBattle';
import { DungeonClash } from './DungeonClash';
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
import { Trophy, Gift, Gamepad2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardProps {
  currentUser: User;
  onUpdateUser: (user: User) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, onUpdateUser }) => {
  // ==========================================
  // LOCAL STATE (Sadece UI state'leri)
  // ==========================================
  
  // Tab yönetimi
  const [mainTab, setMainTab] = useState<'games' | 'leaderboard' | 'achievements'>('games');
  
  // Masa kodu state
  const [tableCode, setTableCode] = useState(currentUser.table_number || '');
  const [isMatched, setIsMatched] = useState(!!currentUser.table_number);
  
  // Modal state'leri
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // ==========================================
  // CUSTOM HOOKS
  // ==========================================
  
  const {
    games,
    loading: gamesLoading,
    activeGameId,
    activeGameType,
    opponentName,
    isBot,
    serverActiveGame,
    createGame,
    joinGame,
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
      alert('Oyuna katılırken hata oluştu.');
    }
  };

  // Aktif oyuna geri dön
  const handleRejoinGame = () => {
    if (serverActiveGame) {
      setActiveGame(
        serverActiveGame.id,
        serverActiveGame.gameType,
        serverActiveGame.hostName
      );
    }
  };

  // Ödül satın alma
  const handleBuyReward = async (reward: typeof rewards[0]) => {
    try {
      const result = await buyReward(reward);
      
      // Kullanıcı puanını güncelle
      onUpdateUser({
        ...currentUser,
        points: result.newPoints
      });
      
      alert(`${reward.title} satın alındı! Kupon kodu: ${result.code}`);
    } catch (err: any) {
      alert(err.message || 'Satın alma başarısız.');
    }
  };

  // Profil görüntüleme
  const handleViewProfile = (user: User) => {
    setProfileUser(user);
    setIsProfileOpen(true);
  };

  // Oyundan ayrılma (oyun sonu)
  const handleGameFinish = () => {
    leaveGame();
  };

  // ==========================================
  // RENDER: Aktif Oyun Ekranı
  // ==========================================
  
  if (activeGameId) {
    return (
      <div className="min-h-screen bg-[#0f141a] py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Geri butonu */}
          <div className="mb-6">
            <RetroButton onClick={handleGameFinish} variant="secondary">
              ← Lobiye Dön
            </RetroButton>
          </div>

          {/* Oyun component'leri */}
          {activeGameType === 'Taş Kağıt Makas' ? (
            <RockPaperScissors
              gameId={activeGameId}
              username={currentUser.username}
              opponent={opponentName}
              isHost={!opponentName}
            />
          ) : activeGameType === 'Zindan Savaşı' ? (
            <DungeonClash
              gameId={activeGameId}
              currentUser={currentUser}
              onFinish={handleGameFinish}
            />
          ) : (
            <ArenaBattle
              gameId={activeGameId}
              currentUser={currentUser}
              onFinish={handleGameFinish}
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
    <div className="min-h-screen bg-[#0f141a] py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Status Bar */}
        <StatusBar
          user={currentUser}
          tableCode={tableCode}
          isMatched={isMatched}
        />

        {/* Main Navigation Tabs */}
        <div className="relative bg-[#151921] p-1.5 md:p-2 rounded-xl">
          <div className="flex items-center gap-1 md:gap-2">
            {[
              { id: 'games', label: 'Oyunlar', icon: Gamepad2, color: 'blue' },
              { id: 'leaderboard', label: 'Sıralama', icon: Trophy, color: 'yellow' },
              { id: 'achievements', label: 'Başarımlar', icon: Gift, color: 'purple' }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = mainTab === tab.id;
              
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setMainTab(tab.id as typeof mainTab)}
                  data-testid={`dashboard-tab-${tab.id}`}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-lg font-medium transition-colors text-sm md:text-base ${
                    isActive
                      ? tab.color === 'blue' ? 'text-white' : tab.color === 'yellow' ? 'text-black' : 'text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className={`absolute inset-0 rounded-lg ${
                        tab.color === 'blue' ? 'bg-blue-500' : 
                        tab.color === 'yellow' ? 'bg-yellow-500' : 
                        'bg-purple-500'
                      }`}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 md:gap-2">
                    <Icon size={18} className="md:w-5 md:h-5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
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
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
                {/* Sol: Oyun Lobisi */}
                <div className="xl:col-span-2 order-2 xl:order-1">
                  <GameSection
                    currentUser={currentUser}
                    tableCode={tableCode}
                    isMatched={isMatched}
                    games={games}
                    gamesLoading={gamesLoading}
                    activeGameId={activeGameId}
                    serverActiveGame={serverActiveGame}
                    isCreateModalOpen={isCreateModalOpen}
                    setIsCreateModalOpen={setIsCreateModalOpen}
                    onCreateGame={handleCreateGame}
                    onJoinGame={handleJoinGame}
                    onViewProfile={handleViewProfile}
                    onRejoinGame={handleRejoinGame}
                  />
                </div>

                {/* Sağ: Mağaza & Envanter */}
                <div className="xl:col-span-1 order-1 xl:order-2">
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
              <Leaderboard currentUser={currentUser} />
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
        />
      </div>
    </div>
  );
};

export default Dashboard;
