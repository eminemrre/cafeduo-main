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
import { Trophy, Gift, Gamepad2 } from 'lucide-react';

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
        <div className="flex items-center gap-2 bg-[#151921] p-2 rounded-xl">
          <button
            onClick={() => setMainTab('games')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              mainTab === 'games'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Gamepad2 size={20} />
            Oyunlar
          </button>
          <button
            onClick={() => setMainTab('leaderboard')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              mainTab === 'leaderboard'
                ? 'bg-yellow-500 text-black'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Trophy size={20} />
            Sıralama
          </button>
          <button
            onClick={() => setMainTab('achievements')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              mainTab === 'achievements'
                ? 'bg-purple-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Gift size={20} />
            Başarımlar
          </button>
        </div>

        {/* Tab Content */}
        {mainTab === 'games' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sol: Oyun Lobisi */}
            <div className="lg:col-span-2">
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
            <div className="lg:col-span-1">
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
