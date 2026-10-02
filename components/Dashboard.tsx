/**
 * Dashboard Component (Refactored)
 *
 * @description Ana dashboard container - sadece layout ve state dağıtımı
 * @version 2.0 - Custom hooks ile refactor edilmiş
 */

import React, { useEffect, useRef, useState } from 'react';
import { User, Reward } from '../types';
import { UserProfileModal } from './UserProfileModal';
import { ArenaBattle } from './ArenaBattle';
import { KnowledgeQuiz } from './KnowledgeQuiz';
import { RetroChess } from './RetroChess';
import { Leaderboard } from './Leaderboard';
import { Achievements } from './Achievements';
import { RetroButton } from './RetroButton';
import { MatchResultCard, type MatchStats } from './dashboard/MatchResultCard';
import { useConfirm } from './ui/ConfirmDialog';

// Hooks
import { useGames } from '../hooks/useGames';
import { useRewards } from '../hooks/useRewards';
import { useActiveTournament } from '../hooks/useActiveTournament';
import { useToast } from '../contexts/ToastContext';

// Sub-components
import { StatusBar } from './dashboard/StatusBar';
import { TournamentBanner } from './TournamentBanner';
import { TournamentLeaderboardModal } from './TournamentLeaderboardModal';
import { GameSection } from './dashboard/GameSection';
import { RewardSection } from './dashboard/RewardSection';
import { DailyRewardWheel } from './dashboard/DailyRewardWheel';

// Icons
import { Trophy, Gift, Gamepad2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';

interface DashboardProps {
  currentUser: User;
  onUpdateUser: (user: User, options?: { throwOnError?: boolean }) => Promise<void> | void;
  onRefreshUser?: () => Promise<void> | void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  onUpdateUser,
  onRefreshUser,
}) => {
  const toast = useToast();
  const { confirm: confirmAction, confirmDialog } = useConfirm();

  const normalizeTableCode = (raw: unknown): string => {
    const value = String(raw || '')
      .trim()
      .toUpperCase();
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
  const [isMatched, setIsMatched] = useState(
    Boolean(currentUser.cafe_id) && Boolean(normalizeTableCode(currentUser.table_number))
  );

  // Modal state'leri
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [gameResult, setGameResult] = useState<{
    winner: string;
    earnedPoints: number;
    stats?: MatchStats;
  } | null>(null);
  const [leavingGame, setLeavingGame] = useState(false);
  const [_showGlitchAnim, setShowGlitchAnim] = useState(false);
  const gameEndHandledRef = useRef(false);
  /**
   * Synchronous flag tracking whether the active match has reached a server-
   * resolved end state. Game components call `handleMatchSettled` the moment
   * their internal `serverStatus === 'finished'` (or `live.done`) flips. This
   * short-circuits the forfeit confirm in handleLeaveGame so the user is not
   * prompted with "Oyundan çıkarsan mağlup sayılacaksın" after they have
   * already lost or won server-side (the actual gameResult is still set via
   * the ~700-900ms delayed onGameEnd path).
   */
  const matchSettledRef = useRef(false);

  const handleMatchSettled = React.useCallback(() => {
    matchSettledRef.current = true;
  }, []);

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
    setActiveGame,
  } = useGames({ currentUser, tableCode });

  // Banner data — cafe-scoped. When the user isn't checked in,
  // useActiveTournament returns null and the banner won't render.
  const { tournament: activeTournament } = useActiveTournament(
    currentUser.cafe_id ? Number(currentUser.cafe_id) : null
  );
  const [tournamentLeaderboardOpen, setTournamentLeaderboardOpen] = useState(false);

  const {
    rewards,
    rewardsLoading,
    inventory,
    inventoryLoading,
    activeTab: rewardTab,
    setActiveTab: setRewardTab,
    buyReward,
  } = useRewards({ currentUser });

  useEffect(() => {
    const normalizedTable = normalizeTableCode(currentUser.table_number);
    setTableCode(normalizedTable);
    setIsMatched(Boolean(currentUser.cafe_id) && Boolean(normalizedTable));
  }, [currentUser.cafe_id, currentUser.table_number]);

  // Reset per-match refs when the active game changes — otherwise a
  // previously-settled flag would suppress the forfeit confirm on a fresh
  // ongoing match.
  useEffect(() => {
    matchSettledRef.current = false;
    gameEndHandledRef.current = false;
  }, [activeGameId]);

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
      throw new Error('Oyun kurmak için önce bir masaya bağlanmalısın!');
    }
    // The dialog owns pending/error feedback. Propagate rejection so it does
    // not interpret a failed request as a successful game creation.
    await createGame(gameType, points, options);
    setIsCreateModalOpen(false);
  };

  // Oyuna katılma
  const handleJoinGame = async (gameId: number) => {
    if (!isMatched) {
      toast.warning('Oyuna katılmak için önce bir masaya bağlanmalısın!');
      return;
    }

    try {
      await joinGame(gameId);
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Oyuna katılırken hata oluştu.';
      toast.error(message);
    }
  };

  // Aktif oyuna geri dön
  const handleRejoinGame = () => {
    if (serverActiveGame) {
      const rejoinOpponent =
        serverActiveGame.hostName === currentUser.username
          ? serverActiveGame.guestName || 'Rakip'
          : serverActiveGame.hostName;

      setActiveGame(serverActiveGame.id, serverActiveGame.gameType, rejoinOpponent);
    }
  };

  // Ödül satın alma
  const handleBuyReward = async (reward: Reward) => {
    try {
      const result = await buyReward(reward);

      // Kullanıcı puanını güncelle
      onUpdateUser({
        ...currentUser,
        points: result.newPoints,
      });

      toast.success(`${reward.title} satın alındı! Kupon kodu: ${result.code}`);
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : 'Satın alma başarısız.';
      toast.error(message);
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
    await onUpdateUser(updatedUser, { throwOnError: true });
    setProfileUser(updatedUser);
  };

  const handleSaveAvatar = async (avatarUrl: string) => {
    if (!isOwnProfile) return;
    await onUpdateUser({ ...currentUser, avatar_url: avatarUrl }, { throwOnError: true });
  };

  const handleCancelGame = async (gameId: number | string) => {
    try {
      await cancelGame(gameId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Oyun iptal edilirken hata oluştu.';
      toast.error(message);
    }
  };

  const performLeaveGame = async () => {
    if (leavingGame) return;
    setLeavingGame(true);
    try {
      const shouldApplyForfeit = Boolean(activeGameId) && !isBot && !gameResult;
      if (shouldApplyForfeit && activeGameId) {
        // Use /resign instead of /finish: finishGameHandler rejects non-admin callers
        // when there's no server-resolved winner yet (returns 409 server_result_pending),
        // which let aim/quiz forfeiters escape with no penalty. /resign lets the actor
        // declare themselves the loser, server picks the opponent as winner, settlement
        // runs as normal. For chess, RetroChess already called /resign first; the second
        // call below will 409 (status already finished) and be safely swallowed.
        try {
          await api.games.resign(activeGameId);
        } catch (err) {
          // Already-resigned / race-with-finish are expected here — log and continue.
          console.error('Forfeit resign request failed:', err);
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

  const handleLeaveGame = async () => {
    // Only warn about forfeit when the match is genuinely still in progress.
    // If gameResult is already set OR the game component told us the server
    // marked the match settled (matchSettledRef), skip the confirm — the
    // user is not abandoning anything, the match is over.
    const matchInProgress = !gameResult && !matchSettledRef.current;
    if (matchInProgress) {
      const accepted = await confirmAction({
        title: 'Oyundan çık',
        message: 'Oyundan çıkarsan mağlup sayılacaksın. Oyundan çıkmak istiyor musun?',
        confirmLabel: 'Çık',
        cancelLabel: 'Oyuna dön',
        danger: true,
      });
      if (!accepted) return;
    }
    void performLeaveGame();
  };

  // Manuel dönüş (istatistik işlemeden)
  const handleBackToLobby = () => {
    void handleLeaveGame();
  };

  // Oyun sonu (istatistik + puan güncelleme)
  const handleGameFinish = (winner: string, earnedPoints: number, stats?: MatchStats) => {
    if (gameEndHandledRef.current) return;
    gameEndHandledRef.current = true;
    const safeEarnedPoints = Number.isFinite(earnedPoints) ? earnedPoints : 0;
    setGameResult((prev) => prev ?? { winner, earnedPoints: safeEarnedPoints, stats });
    setShowGlitchAnim(true);

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
      <div className="min-h-screen bg-paper text-carbon pt-[calc(6rem+env(safe-area-inset-top))] md:pt-24 pb-[calc(8rem+env(safe-area-inset-bottom))] px-4 relative overflow-hidden">
        {/* Cyber glitch animation retired in PR #25 — game-end toast covers it */}
        <div className="absolute inset-0 opacity-0 opacity-[0.06] pointer-events-none" />
        <div className="max-w-6xl mx-auto">
          {/* Geri butonu */}
          <div className="mb-6">
            <RetroButton onClick={handleBackToLobby} variant="secondary">
              ← Lobiye Dön
            </RetroButton>
          </div>

          {gameResult && (
            <MatchResultCard
              winner={gameResult.winner}
              earnedPoints={gameResult.earnedPoints}
              stats={gameResult.stats}
              currentUsername={currentUser.username}
              onDismiss={handleBackToLobby}
              dismissing={leavingGame}
            />
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
              onMatchSettled={handleMatchSettled}
            />
          ) : activeGameType === 'Bilgi Yarışı' ? (
            <KnowledgeQuiz
              gameId={activeGameId}
              currentUser={currentUser}
              opponentName={opponentName || 'Rakip'}
              isBot={isBot}
              onGameEnd={handleGameFinish}
              onLeave={handleLeaveGame}
              onMatchSettled={handleMatchSettled}
            />
          ) : activeGameType === 'Nişancı Düellosu' ? (
            <ArenaBattle
              gameId={activeGameId}
              currentUser={currentUser}
              opponentName={opponentName || 'Rakip'}
              isBot={isBot}
              onGameEnd={handleGameFinish}
              onLeave={handleLeaveGame}
              onMatchSettled={handleMatchSettled}
            />
          ) : (
            <div className="border-2 border-carbon bg-paper border-riso-redox/30 rounded-xl p-8 text-center">
              <p className="text-riso-redox font-bold text-xl">Bilinmeyen Oyun Türü</p>
              <p className="text-carbon-muted mt-2">{activeGameType}</p>
              <RetroButton onClick={handleBackToLobby} variant="secondary" className="mt-4">
                Lobiye Dön
              </RetroButton>
            </div>
          )}
        </div>
        {/* Forfeit onayı bu ekranda açılır — dialog bu ağaçta da mount olmalı. */}
        {confirmDialog}
      </div>
    );
  }

  // ==========================================
  // RENDER: Ana Dashboard
  // ==========================================

  return (
    <div className="min-h-screen bg-paper text-carbon pt-[calc(6rem+env(safe-area-inset-top))] md:pt-24 pb-[calc(3rem+env(safe-area-inset-bottom))] px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-0 opacity-[0.06] pointer-events-none" />
      <div className="duo-dashboard space-y-7">
        {/* Status Bar */}
        <StatusBar
          user={currentUser}
          tableCode={tableCode}
          isMatched={isMatched}
          onOpenProfile={handleOpenOwnProfile}
        />

        {activeTournament && (
          <TournamentBanner
            tournament={activeTournament}
            onOpenLeaderboard={() => setTournamentLeaderboardOpen(true)}
          />
        )}

        <div className="duo-dashboard-tabs" aria-label="Oyuncu paneli bölümleri">
          {[
            { id: 'games', label: 'Oyunlar', icon: Gamepad2 },
            { id: 'leaderboard', label: 'Sıralama', icon: Trophy },
            { id: 'achievements', label: 'Başarılar', icon: Gift },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMainTab(tab.id as typeof mainTab)}
                data-testid={`dashboard-tab-${tab.id}`}
                aria-pressed={mainTab === tab.id}
                className="duo-dashboard-tab riso-focus"
              >
                <Icon size={20} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
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
                    activeTournament={activeTournament}
                  />
                </div>

                {/* Sağ: Günün Çarkı + Ödüller & Envanter */}
                <div className="order-2 min-w-0 space-y-6">
                  {currentUser.cafe_id && (
                    <DailyRewardWheel
                      cafeId={currentUser.cafe_id}
                      onPointsWon={(points) =>
                        onUpdateUser({ ...currentUser, points: currentUser.points + points })
                      }
                      onGiftWon={() => {
                        if (onRefreshUser) void onRefreshUser();
                      }}
                    />
                  )}
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

            {mainTab === 'leaderboard' && <Leaderboard />}

            {mainTab === 'achievements' && <Achievements userId={currentUser.id} />}
          </motion.div>
        </AnimatePresence>

        {/* Profile Modal */}
        <UserProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          user={profileUser}
          isEditable={isOwnProfile}
          isPreview={!isOwnProfile}
          onSaveProfile={handleSaveProfile}
          onSaveAvatar={handleSaveAvatar}
        />
      </div>
      {activeTournament && (
        <TournamentLeaderboardModal
          isOpen={tournamentLeaderboardOpen}
          onClose={() => setTournamentLeaderboardOpen(false)}
          tournament={activeTournament}
        />
      )}
      {confirmDialog}
    </div>
  );
};

export default Dashboard;
