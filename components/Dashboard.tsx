import React, { useState, useEffect } from 'react';
import { RetroButton } from './RetroButton';
import { User, GameRequest, Reward, RedeemedReward } from '../types';
import { GameLobby } from './GameLobby';
import { CreateGameModal } from './CreateGameModal';
import { UserProfileModal } from './UserProfileModal';
import { ArenaBattle } from './ArenaBattle';
import { DungeonClash } from './DungeonClash';
import { RockPaperScissors } from './RockPaperScissors';
import { AdminDashboard } from './AdminDashboard';
import { api } from '../lib/api';
import { Leaderboard } from './Leaderboard';
import { Achievements } from './Achievements';
import {
  Wifi,
  MapPin,
  Trophy,
  Gift,
  Check,
  ShoppingBag,
  Ticket,
  Coffee,
  Percent,
  Cookie,
  Gamepad2
} from 'lucide-react';

// AVAILABLE_REWARDS removed - fetching from API

// Geçerli masa kodları (Backend simülasyonu)
const VALID_TABLES = ['MASA01', 'MASA02', 'MASA03', 'MASA04', 'MASA05'];

interface DashboardProps {
  currentUser: User;
  onUpdateUser: (user: User) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, onUpdateUser }) => {
  // Admin Check removed - handled by Router

  // State Yönetimi
  const [requests, setRequests] = useState<GameRequest[]>([]);
  const [tableCode, setTableCode] = useState('');
  const [isMatched, setIsMatched] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [loadingTable, setLoadingTable] = useState(false);

  // Oyun Kurma Modali State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Profil Modali State
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Ödül State'leri
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redeemedRewards, setRedeemedRewards] = useState<RedeemedReward[]>([]);
  const [rewardTab, setRewardTab] = useState<'shop' | 'inventory'>('shop');

  // Active Game State
  const [activeGameId, setActiveGameId] = useState<number | null>(null);
  const [activeGameType, setActiveGameType] = useState<string>('');
  const [opponentName, setOpponentName] = useState<string | undefined>(undefined);
  const [isBot, setIsBot] = useState<boolean>(false); // Explicit bot tracking
  const [serverActiveGame, setServerActiveGame] = useState<GameRequest | null>(null);

  // Main Tab State
  const [mainTab, setMainTab] = useState<'games' | 'leaderboard' | 'achievements'>('games');

  // Load Games & Inventory
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const games = await api.games.list();
        // Filter out unknown users
        const validGames = games.filter((g: GameRequest) =>
          g.hostName && g.hostName.toLowerCase() !== 'unknown'
        );
        setRequests(validGames);
      } catch (error) {
        console.error("Failed to load games", error);
      }
    };

    const fetchInventory = async () => {
      try {
        const data = await api.shop.inventory(currentUser.id);
        setRedeemedRewards(data.map((item: any) => ({
          ...item,
          redeemedAt: new Date(item.redeemedAt)
        })));
      } catch (error) {
        console.error("Failed to load inventory", error);
      }
    };

    const fetchRewards = async () => {
      try {
        const data = await api.rewards.list();
        setRewards(data);
      } catch (error) {
        console.error("Failed to load rewards", error);
      }
    };

    const checkActiveGame = async () => {
      // If we already have an active game locally, don't overwrite it with null from server immediately
      // But if server says we have a game, and we don't, we should sync.
      // However, if user explicitly left, we want to avoid auto-rejoin loop.
      // For now, let's just sync if we are NOT in a game locally.
      if (activeGameId) return;

      try {
        const game = await api.users.getActiveGame(currentUser.username);
        setServerActiveGame(game);

        // Only auto-join if we found a game and we are not currently in one
        if (game && !activeGameId) {
          // OPTIONAL: Ask user "Rejoin game?" instead of forcing.
          // For now, let's NOT auto-join to break the loop.
          // User can click "Rejoin" button if we add one.
          // But wait, the UI shows "Active Game" banner if serverActiveGame is set.
          // So we just set serverActiveGame and let the UI handle it.
        }
      } catch (error) {
        console.error("Failed to check active game", error);
      }
    };

    fetchGames();
    fetchInventory();
    fetchRewards();
    checkActiveGame();

    // Polling for new games (Real-time effect)
    const interval = setInterval(() => {
      fetchGames();
      checkActiveGame();
    }, 5000);

    // Auto-connect if user has table number
    if (currentUser.table_number) {
      setTableCode(currentUser.table_number);
      setIsMatched(true);
    }

    return () => clearInterval(interval);
  }, [currentUser.id, currentUser.table_number]);

  // MASA BAĞLAMA FONKSİYONU
  const handleTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMatchError('');
    setLoadingTable(true);

    setTimeout(() => {
      const formattedCode = tableCode.toUpperCase().replace(/\s/g, '');
      if (VALID_TABLES.includes(formattedCode)) {
        setIsMatched(true);
        setTableCode(formattedCode);
      } else {
        setMatchError('Geçersiz masa kodu! (Örn: MASA01)');
      }
      setLoadingTable(false);
    }, 1000);
  };

  // OYUN KURMA FONKSİYONU
  const handleCreateGame = async (gameType: string, points: number) => {
    if (!isMatched) {
      alert("Oyun kurmak için önce bir masaya bağlanmalısın!");
      setIsCreateModalOpen(false);
      return;
    }

    try {
      const newGame = await api.games.create({
        hostName: currentUser.username,
        gameType,
        points,
        table: tableCode || currentUser.table_number || 'MASA00'
      });

      setRequests([newGame, ...requests]);
      setIsCreateModalOpen(false);

      // Auto-join as host - NOT a bot game, wait for opponent
      setActiveGameId(newGame.id);
      setActiveGameType(gameType);
      setOpponentName(undefined); // Waiting for opponent
      setIsBot(false); // Explicitly NOT a bot game
    } catch (error) {
      alert("Oyun kurulurken hata oluştu.");
    }
  };

  // OYUNA KATILMA FONKSİYONU
  const handleJoinGame = async (id: number) => {
    if (!isMatched) {
      alert("Oyuna katılmak için önce bir masaya bağlanmalısın!");
      return;
    }

    try {
      await api.games.join(id, currentUser.username);
      const game = requests.find(r => r.id === id);
      setRequests(requests.filter(req => req.id !== id));

      setActiveGameId(id);
      setActiveGameType(game?.gameType || 'Arena Savaşı');
      setOpponentName(game?.hostName); // Joiner sees host
      setIsBot(false); // Joining means real opponent
    } catch (error) {
      alert("Oyuna katılırken hata oluştu.");
    }
  };

  const handleGameEnd = async (winner: string, points: number) => {
    // User requested constant 10 points per win
    const WIN_POINTS = 10;

    if (winner === currentUser.username) {
      const newPoints = currentUser.points + WIN_POINTS;
      const newWins = currentUser.wins + 1;
      const newGamesPlayed = currentUser.gamesPlayed + 1;

      try {
        await api.users.update({
          ...currentUser,
          points: newPoints,
          wins: newWins,
          gamesPlayed: newGamesPlayed
        });
        onUpdateUser({ ...currentUser, points: newPoints, wins: newWins, gamesPlayed: newGamesPlayed });
      } catch (err) {
        console.error("Failed to update stats", err);
      }
    } else {
      // Update games played even if lost
      const newGamesPlayed = currentUser.gamesPlayed + 1;
      try {
        await api.users.update({
          ...currentUser,
          gamesPlayed: newGamesPlayed
        });
        onUpdateUser({ ...currentUser, gamesPlayed: newGamesPlayed });
      } catch (err) {
        console.error("Failed to update stats", err);
      }
    }

    setActiveGameId(null);
    setActiveGameType('');
  };

  // PROFİL GÖRÜNTÜLEME
  const handleViewProfile = (username: string) => {
    if (username === currentUser.username) {
      setProfileUser(currentUser);
    } else {
      // Not: Gerçek projede burada api.users.get(username) çağrılır
      setProfileUser({
        id: 999,
        username: username,
        email: 'player@cafe.com',
        points: Math.floor(Math.random() * 2000),
        wins: Math.floor(Math.random() * 50),
        gamesPlayed: Math.floor(Math.random() * 100)
      });
    }
    setIsProfileOpen(true);
  };

  // ÖDÜL ALMA FONKSİYONU
  const handleRedeemReward = async (reward: Reward) => {
    if (currentUser.points < reward.cost) return;

    if (window.confirm(`${reward.title} ödülünü ${reward.cost} puan karşılığında almak istiyor musun?`)) {
      try {
        const data = await api.shop.buy(currentUser.id, reward.id);

        if (data.success) {
          onUpdateUser({ ...currentUser, points: data.newPoints });

          const newRedemption: RedeemedReward = {
            ...reward,
            redeemId: data.reward.id,
            redeemedAt: new Date(data.reward.redeemed_at),
            code: data.reward.code
          };

          setRedeemedRewards([newRedemption, ...redeemedRewards]);
          setRewardTab('inventory');
        } else {
          alert(data.error);
        }
      } catch (err) {
        alert('Satın alma işlemi başarısız.');
      }
    }
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'coffee': return <Coffee size={24} />;
      case 'discount': return <Percent size={24} />;
      case 'dessert': return <Cookie size={24} />;
      default: return <Gamepad2 size={24} />;
    }
  };

  // Render Active Game
  if (activeGameId) {
    return (
      <div className="pt-24 pb-12 px-4 min-h-screen bg-[#0f141a]">
        <div className="max-w-4xl mx-auto">
          {activeGameType === 'Taş Kağıt Makas' ? (
            <RockPaperScissors
              currentUser={currentUser}
              isBot={isBot}
              onGameEnd={handleGameEnd}
              onLeave={() => handleGameEnd('forfeit', 0)}
            />
          ) : activeGameType === 'Zindan Savaşı' ? (
            <DungeonClash
              currentUser={currentUser}
              gameId={activeGameId}
              onGameEnd={handleGameEnd}
              onLeave={() => handleGameEnd('forfeit', 0)}
              onMinimize={() => setActiveGameId(null)}
              isBot={isBot}
              opponentName={opponentName}
            />
          ) : (
            <ArenaBattle
              currentUser={currentUser}
              gameId={activeGameId}
              onGameEnd={handleGameEnd}
              onLeave={() => handleGameEnd('forfeit', 0)}
              onMinimize={() => setActiveGameId(null)}
              isBot={isBot}
              opponentName={opponentName}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-12 px-4 min-h-screen bg-[#0f141a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f141a] to-black relative">

      <CreateGameModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateGame}
        maxPoints={currentUser.points}
      />

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={profileUser}
      />

      <div className="max-w-7xl mx-auto">

        {/* Top Status Bar */}
        <div className="mb-8 bg-slate-900/80 border border-slate-700 rounded-lg p-4 flex flex-wrap justify-between items-center gap-4 shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-md sticky top-20 z-40">
          <button
            onClick={() => handleViewProfile(currentUser.username)}
            className="flex items-center gap-4 hover:bg-white/5 p-2 rounded transition-colors group"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center border-2 border-white shadow-lg group-hover:scale-105 transition-transform overflow-hidden">
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt={currentUser.username} className="w-full h-full object-cover" />
              ) : (
                <span className="font-pixel text-xl">{(currentUser.username || '?').substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="text-left">
              <h2 className="font-pixel text-lg md:text-xl text-white group-hover:text-blue-300 transition-colors">HOŞGELDİN, {currentUser.username}</h2>
              <div className="flex items-center gap-2 text-xs font-mono text-green-400">
                <span className="animate-pulse">●</span> SYSTEM ONLINE
              </div>
            </div>
          </button>

          <div className="flex items-center gap-6 bg-black/40 px-6 py-2 rounded-full border border-slate-700">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">Toplam Puan</span>
              <span className="font-retro text-3xl text-yellow-400 leading-none shadow-yellow-500/20 drop-shadow-sm">{currentUser.points}</span>
            </div>
            <Trophy className="text-yellow-500" size={28} />
          </div>
        </div>

        {/* Main Navigation Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-1 overflow-x-auto">
          <button
            onClick={() => setMainTab('games')}
            className={`px-6 py-3 font-pixel text-sm transition-all border-b-2 ${mainTab === 'games' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            OYUN MERKEZİ
          </button>
          <button
            onClick={() => setMainTab('leaderboard')}
            className={`px-6 py-3 font-pixel text-sm transition-all border-b-2 ${mainTab === 'leaderboard' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            LİDERLİK TABLOSU
          </button>
          <button
            onClick={() => setMainTab('achievements')}
            className={`px-6 py-3 font-pixel text-sm transition-all border-b-2 ${mainTab === 'achievements' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            BAŞARIMLAR
          </button>
        </div>

        {mainTab === 'leaderboard' && <Leaderboard />}

        {mainTab === 'achievements' && <Achievements userId={currentUser.id} />}

        {mainTab === 'games' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* LEFT PANEL: Step 1 - Table Status (Simplified) */}
            <div className="space-y-6">
              <div className="bg-[#1a1f2e] border-4 border-green-600 relative overflow-hidden">
                <div className="bg-gray-800 p-2 flex items-center justify-between border-b-2 border-gray-600">
                  <span className="font-pixel text-xs text-gray-400">STATUS // CONNECTED</span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  </div>
                </div>

                <div className="p-6 relative z-10 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500 animate-pulse-slow">
                      <MapPin size={40} className="text-green-400" />
                    </div>
                  </div>

                  <h3 className="font-pixel text-lg text-gray-400 mb-1">BAĞLI MASA</h3>
                  <div className="font-retro text-4xl text-white tracking-widest mb-2">
                    {currentUser.table_number || 'MASA??'}
                  </div>
                  <div className="text-green-500 font-mono text-xs uppercase tracking-widest bg-green-500/10 inline-block px-3 py-1 rounded">
                    {currentUser.cafe_name || 'Bilinmeyen Kafe'}
                  </div>
                </div>

                <div className="absolute bottom-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Wifi size={120} />
                </div>
              </div>

              <div className="bg-[#1a1f2e] p-4 border-2 border-gray-700 rounded-lg">
                <h4 className="font-pixel text-sm text-gray-400 mb-3">İSTATİSTİKLER</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 p-3 rounded border border-gray-700">
                    <span className="block text-xs text-gray-500 mb-1">Oyun Sayısı</span>
                    <span className="font-retro text-2xl text-white">{currentUser.gamesPlayed}</span>
                  </div>
                  <div className="bg-black/40 p-3 rounded border border-gray-700">
                    <span className="block text-xs text-gray-500 mb-1">Galibiyet</span>
                    <span className="font-retro text-2xl text-green-400">{currentUser.wins}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MIDDLE PANEL: Step 2 - Game Lobby */}
            <div className="lg:col-span-2">
              {serverActiveGame && !activeGameId && (
                <div className="mb-6 bg-green-900/30 border-2 border-green-500 rounded-xl p-4 flex items-center justify-between animate-pulse-slow">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                      <Gamepad2 className="text-white" size={24} />
                    </div>
                    <div>
                      <h3 className="font-pixel text-white text-lg">DEVAM EDEN OYUNUN VAR!</h3>
                      <p className="text-green-300 text-sm">{serverActiveGame.gameType} - {serverActiveGame.table}</p>
                    </div>
                  </div>
                  <RetroButton
                    variant="primary"
                    onClick={() => {
                      setActiveGameId(serverActiveGame.id);
                      setActiveGameType(serverActiveGame.gameType);
                      // Determine opponent name
                      const isHost = currentUser.username === serverActiveGame.hostName;
                      setOpponentName(isHost ? serverActiveGame.guestName : serverActiveGame.hostName);
                    }}
                  >
                    OYUNA DÖN
                  </RetroButton>
                </div>
              )}

              <GameLobby
                currentUser={currentUser}
                requests={requests}
                onJoinGame={handleJoinGame}
                onCreateGameClick={() => setIsCreateModalOpen(true)}
                onViewProfile={handleViewProfile}
              />
            </div>

            {/* RIGHT PANEL: Step 3 - Rewards */}
            <div className="lg:col-span-3 mt-8">
              <div className="mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Gift size={32} className="text-yellow-400" />
                  <div>
                    <h3 className="font-pixel text-2xl text-white">ÖDÜL MERKEZİ</h3>
                    <p className="text-gray-400 text-sm">Puanlarını harca, kafede keyfini çıkar.</p>
                  </div>
                </div>

                <div className="flex bg-black p-1 rounded-lg border border-gray-700">
                  <button
                    onClick={() => setRewardTab('shop')}
                    className={`px-6 py-2 rounded font-pixel text-sm transition-all ${rewardTab === 'shop' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                  >
                    MAĞAZA
                  </button>
                  <button
                    onClick={() => setRewardTab('inventory')}
                    className={`px-6 py-2 rounded font-pixel text-sm transition-all ${rewardTab === 'inventory' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    KUPONLARIM ({redeemedRewards.length})
                  </button>
                </div>
              </div>

              {rewardTab === 'shop' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {rewards.map((reward) => {
                    const canAfford = currentUser.points >= reward.cost;
                    return (
                      <div key={reward.id} className={`relative group bg-[#1a1f2e] border-2 ${canAfford ? 'border-yellow-500/30 hover:border-yellow-500' : 'border-gray-700 opacity-60'} rounded-xl p-6 flex flex-col justify-between overflow-hidden transition-all duration-300 h-full`}>

                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full pointer-events-none"></div>

                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-lg ${canAfford ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700/50 text-gray-500'}`}>
                              {getRewardIcon(reward.icon)}
                            </div>
                            <div className="text-right">
                              <span className={`block font-retro text-3xl ${canAfford ? 'text-white' : 'text-red-400'}`}>{reward.cost}</span>
                            </div>
                          </div>
                          <h4 className="text-lg font-bold text-white mb-1 font-pixel leading-tight min-h-[3rem]">{reward.title}</h4>
                          <p className="text-xs text-gray-400 mb-6">{reward.description}</p>
                        </div>

                        <button
                          disabled={!canAfford}
                          onClick={() => handleRedeemReward(reward)}
                          className={`w-full py-3 font-pixel text-sm rounded flex items-center justify-center gap-2 transition-all border-b-4 active:border-b-0 active:translate-y-1 ${canAfford
                            ? 'bg-yellow-500 hover:bg-yellow-400 text-black border-yellow-700'
                            : 'bg-gray-800 text-gray-500 border-gray-900 cursor-not-allowed'
                            }`}
                        >
                          {canAfford ? (
                            <>SATIN AL <ShoppingBag size={16} /></>
                          ) : (
                            'YETERSİZ PUAN'
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#151921] border-2 border-dashed border-gray-700 rounded-xl p-6 min-h-[300px]">
                  {redeemedRewards.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
                      <Ticket size={64} className="mb-4 opacity-20" />
                      <p className="font-pixel text-lg">HENÜZ KUPONUN YOK</p>
                      <p className="text-sm mt-2">Mağazadan puanlarınla ödül alabilirsin.</p>
                      <button onClick={() => setRewardTab('shop')} className="mt-6 text-blue-400 hover:underline font-pixel text-sm">MAĞAZAYA GİT</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {redeemedRewards.map((item: any) => {
                        const expirationDate = new Date(new Date(item.redeemedAt).getTime() + 5 * 24 * 60 * 60 * 1000);
                        const isExpired = new Date() > expirationDate;
                        const isUsed = item.status === 'used';

                        return (
                          <div key={item.redeemId} className={`relative overflow-hidden font-mono shadow-lg transform hover:scale-105 transition-transform ${isUsed || isExpired ? 'grayscale opacity-70' : ''}`}>
                            <div className={`bg-[#fff8dc] text-black p-4 rounded h-full flex flex-col justify-between`}>
                              {/* Holes */}
                              <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-[#151921] rounded-full"></div>
                              <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-[#151921] rounded-full"></div>

                              <div className="border-2 border-black border-dashed p-3 h-full flex flex-col justify-between relative">
                                {isUsed && (
                                  <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <div className="bg-red-600 text-white font-bold text-xl px-4 py-2 rotate-[-15deg] border-4 border-white shadow-xl">KULLANILDI</div>
                                  </div>
                                )}
                                {isExpired && !isUsed && (
                                  <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <div className="bg-gray-600 text-white font-bold text-xl px-4 py-2 rotate-[-15deg] border-4 border-white shadow-xl">SÜRESİ DOLDU</div>
                                  </div>
                                )}

                                <div className="text-center border-b-2 border-black pb-2 mb-2">
                                  <h4 className="font-bold text-lg uppercase leading-tight">{item.title}</h4>
                                  <span className="text-xs">CAFE DUO KUPONU</span>
                                </div>

                                <div className="flex justify-between items-center mb-2">
                                  <div className="w-16 h-16 bg-black text-white flex items-center justify-center text-[8px] p-1 text-center leading-none">
                                    QR KOD ALANI
                                  </div>
                                  <div className="text-right">
                                    <span className="block text-2xl font-bold tracking-widest">{item.code}</span>
                                    <span className="text-[10px] block">SKT: {expirationDate.toLocaleDateString()}</span>
                                  </div>
                                </div>

                                <div className="text-[10px] text-center italic opacity-70">
                                  *Bu kupon tek kullanımlıktır.
                                </div>

                                <div className="bg-black text-white text-center py-1 text-xs font-bold mt-auto uppercase">
                                  KASADA GÖSTERİN
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div >
        )}
      </div >
    </div >
  );
};