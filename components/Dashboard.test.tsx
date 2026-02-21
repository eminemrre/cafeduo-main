/**
 * Dashboard Integration Tests
 * 
 * @description Dashboard component data flow and integration tests
 * Tests: Tab switching, game flow, reward flow, user interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import { User } from '../types';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';

// Mock hooks
jest.mock('../hooks/useGames', () => ({
  useGames: jest.fn()
}));

jest.mock('../hooks/useRewards', () => ({
  useRewards: jest.fn()
}));

// Mock lib/socket (import.meta.env issue)
jest.mock('../lib/socket', () => ({
  socketService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    getSocket: jest.fn().mockReturnValue({
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    }),
  }
}));

// Mock sub-components
jest.mock('./dashboard/StatusBar', () => ({
  StatusBar: ({ user, isMatched }: { user: User; isMatched: boolean }) => (
    <div data-testid="status-bar">
      <span data-testid="user-name">{user.username}</span>
      <span data-testid="match-status">{isMatched ? 'Connected' : 'Not Connected'}</span>
    </div>
  )
}));

jest.mock('./dashboard/GameSection', () => ({
  GameSection: ({
    currentUser,
    isMatched,
    games,
    gamesLoading,
    serverActiveGame,
    onCreateGame,
    onJoinGame,
    onRejoinGame
  }: any) => {
    // Aktif oyun banner'ı göster
    if (serverActiveGame) {
      return (
        <div data-testid="game-section">
          <span>🎮 Aktif Oyunun Var!</span>
          <button onClick={onRejoinGame}>Oyuna Dön</button>
        </div>
      );
    }

    return (
      <div data-testid="game-section">
        <span data-testid="games-count">{games.length}</span>
        <span data-testid="games-loading">{gamesLoading ? 'Loading' : 'Loaded'}</span>
        <button
          data-testid="create-game-btn"
          onClick={() => onCreateGame('Refleks Avı', 50)}
          disabled={!isMatched}
        >
          Oyun Kur
        </button>
        {games.map((game: any) => (
          <button
            key={game.id}
            data-testid={`join-game-${game.id}`}
            onClick={() => onJoinGame(game.id)}
            disabled={!isMatched}
          >
            Katıl: {game.gameType}
          </button>
        ))}
      </div>
    );
  }
}));

jest.mock('./dashboard/RewardSection', () => ({
  RewardSection: ({
    currentUser,
    rewards,
    rewardsLoading,
    inventory,
    activeTab,
    onTabChange,
    onBuyReward
  }: any) => (
    <div data-testid="reward-section">
      <button
        data-testid="shop-tab"
        onClick={() => onTabChange('shop')}
        className={activeTab === 'shop' ? 'active' : ''}
      >
        Mağaza
      </button>
      <button
        data-testid="inventory-tab"
        onClick={() => onTabChange('inventory')}
        className={activeTab === 'inventory' ? 'active' : ''}
      >
        Envanter ({inventory.length})
      </button>
      <span data-testid="rewards-count">{rewards.length}</span>
      <span data-testid="rewards-loading">{rewardsLoading ? 'Loading' : 'Loaded'}</span>
      <span data-testid="user-points">{currentUser.points}</span>
      {rewards.map((reward: any) => (
        <button
          key={reward.id}
          data-testid={`buy-reward-${reward.id}`}
          onClick={() => onBuyReward(reward)}
          disabled={currentUser.points < reward.cost}
        >
          Satın Al: {reward.title}
        </button>
      ))}
    </div>
  )
}));

jest.mock('./Leaderboard', () => ({
  Leaderboard: () => (
    <div data-testid="leaderboard">
      <span>Sıralama Tablosu</span>
    </div>
  )
}));

jest.mock('./Achievements', () => ({
  Achievements: ({ userId }: { userId: number }) => (
    <div data-testid="achievements">
      <span>Başarımlar - Kullanıcı #{userId}</span>
    </div>
  )
}));

// Mock game components (they use socket internally)
jest.mock('./ReflexRush', () => ({
  ReflexRush: ({ gameId, currentUser, opponentName }: any) => (
    <div data-testid="rock-paper-scissors">
      <span>Refleks Avı - {currentUser?.username} vs {opponentName || '?'}</span>
      <span data-testid="game-id">{gameId}</span>
    </div>
  )
}));

jest.mock('./ArenaBattle', () => ({
  ArenaBattle: ({ gameId, currentUser, onGameEnd }: any) => (
    <div data-testid="arena-battle">
      <span>Nişancı Düellosu - {currentUser.username}</span>
      <button onClick={() => onGameEnd?.(currentUser.username, 10)}>Savaşı Bitir</button>
    </div>
  )
}));

jest.mock('./OddEvenSprint', () => ({
  OddEvenSprint: ({ gameId, currentUser, onGameEnd }: any) => (
    <div data-testid="odd-even-sprint">
      <span>Çift Tek Sprint - {currentUser.username}</span>
      <button onClick={() => onGameEnd?.(currentUser.username, 10)}>Savaşı Bitir</button>
    </div>
  )
}));

jest.mock('./KnowledgeQuiz', () => ({
  KnowledgeQuiz: ({ currentUser, onGameEnd }: any) => (
    <div data-testid="knowledge-quiz">
      <span>Bilgi Yarışı - {currentUser.username}</span>
      <button onClick={() => onGameEnd?.(currentUser.username, 10)}>Savaşı Bitir</button>
    </div>
  )
}));

jest.mock('./RetroChess', () => ({
  RetroChess: ({ currentUser, onGameEnd }: any) => (
    <div data-testid="retro-chess">
      <span>Retro Satranç - {currentUser.username}</span>
      <button onClick={() => onGameEnd?.(currentUser.username, 12)}>Savaşı Bitir</button>
    </div>
  )
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useGames } from '../hooks/useGames';
import { useRewards } from '../hooks/useRewards';

const mockUseGames = useGames as jest.MockedFunction<typeof useGames>;
const mockUseRewards = useRewards as jest.MockedFunction<typeof useRewards>;

describe('Dashboard Integration', () => {
  const mockUser: User = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    points: 1000,
    wins: 5,
    gamesPlayed: 10,
    department: 'Computer Science',
    table_number: 'A1',
    cafe_id: 1,
    role: 'user',
    isAdmin: false,
  };

  const mockOnUpdateUser = jest.fn();

  const defaultGamesState = {
    games: [],
    loading: false,
    error: null,
    gameHistory: [],
    historyLoading: false,
    activeGameId: null,
    activeGameType: '',
    opponentName: undefined,
    isBot: false,
    serverActiveGame: null,
    createGame: jest.fn().mockResolvedValue(undefined),
    joinGame: jest.fn().mockResolvedValue(undefined),
    cancelGame: jest.fn().mockResolvedValue(undefined),
    leaveGame: jest.fn(),
    setActiveGame: jest.fn(),
    refetch: jest.fn(),
  };

  const defaultRewardsState = {
    rewards: [],
    rewardsLoading: false,
    rewardsError: null,
    inventory: [],
    inventoryLoading: false,
    inventoryError: null,
    activeTab: 'shop' as const,
    setActiveTab: jest.fn(),
    buyReward: jest.fn().mockResolvedValue({ success: true, code: 'ABC123' }),
    refetchRewards: jest.fn(),
    refetchInventory: jest.fn(),
    canAfford: (cost: number) => cost <= 1000,
  };

  const renderDashboard = (props = {}) => {
    return render(
      <ToastProvider>
        <AuthProvider>
          <Dashboard
            currentUser={mockUser}
            onUpdateUser={mockOnUpdateUser}
            {...props}
          />
        </AuthProvider>
      </ToastProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGames.mockReturnValue(defaultGamesState);
    mockUseRewards.mockReturnValue(defaultRewardsState);
    // Mock localStorage
    Storage.prototype.getItem = jest.fn(() => null);
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  describe('Initial Render', () => {
    it('renders dashboard with user data', () => {
      renderDashboard();

      expect(screen.getByTestId('status-bar')).toBeInTheDocument();
      expect(screen.getByTestId('user-name')).toHaveTextContent('testuser');
      expect(screen.getByTestId('match-status')).toHaveTextContent('Connected');
    });

    it('renders game section by default', () => {
      renderDashboard();

      expect(screen.getByTestId('game-section')).toBeInTheDocument();
      expect(screen.getAllByText('OYUNLAR')[0]).toBeInTheDocument();
    });

    it('renders reward section', () => {
      renderDashboard();

      expect(screen.getByTestId('reward-section')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('switches to leaderboard tab', () => {
      renderDashboard();

      fireEvent.click(screen.getAllByText('SIRALAMA')[0]);

      expect(screen.getByTestId('leaderboard')).toBeInTheDocument();
      expect(screen.queryByTestId('game-section')).not.toBeInTheDocument();
    });

    it('switches to achievements tab', () => {
      renderDashboard();

      fireEvent.click(screen.getAllByText('BAŞARI')[0]);

      expect(screen.getByTestId('achievements')).toBeInTheDocument();
      expect(screen.getByText('Başarımlar - Kullanıcı #1')).toBeInTheDocument();
    });

    it('switches back to games tab', () => {
      renderDashboard();

      // First go to leaderboard
      fireEvent.click(screen.getAllByText('SIRALAMA')[0]);
      expect(screen.getByTestId('leaderboard')).toBeInTheDocument();

      // Then go back to games
      fireEvent.click(screen.getAllByText('OYUNLAR')[0]);
      expect(screen.getByTestId('game-section')).toBeInTheDocument();
    });
  });

  describe('Game Flow', () => {
    it('displays loading state while fetching games', () => {
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        loading: true,
      });

      renderDashboard();

      expect(screen.getByTestId('games-loading')).toHaveTextContent('Loading');
    });

    it('displays games when loaded', () => {
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        games: [
          { id: 1, gameType: 'Refleks Avı', points: 50, hostName: 'user1', table: 'A1', status: 'waiting' },
          { id: 2, gameType: 'Retro Satranç', points: 100, hostName: 'user2', table: 'B2', status: 'waiting' },
        ],
      });

      renderDashboard();

      expect(screen.getByTestId('games-count')).toHaveTextContent('2');
      expect(screen.getByTestId('join-game-1')).toHaveTextContent('Katıl: Refleks Avı');
      expect(screen.getByTestId('join-game-2')).toHaveTextContent('Katıl: Retro Satranç');
    });

    it('allows creating game when table is matched', async () => {
      const mockCreateGame = jest.fn().mockResolvedValue(undefined);
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        createGame: mockCreateGame,
      });

      renderDashboard();

      fireEvent.click(screen.getByTestId('create-game-btn'));

      await waitFor(() => {
        expect(mockCreateGame).toHaveBeenCalledWith('Refleks Avı', 50, undefined);
      });
    });

    it('allows joining a game', async () => {
      const mockJoinGame = jest.fn().mockResolvedValue(undefined);
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        games: [{ id: 1, gameType: 'Refleks Avı', points: 50, hostName: 'user1', table: 'A1', status: 'waiting' }],
        joinGame: mockJoinGame,
      });

      renderDashboard();

      fireEvent.click(screen.getByTestId('join-game-1'));

      await waitFor(() => {
        expect(mockJoinGame).toHaveBeenCalledWith(1);
      });
    });

    it('shows active game screen when in a game', () => {
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        activeGameId: 'game123',
        activeGameType: 'Refleks Avı',
        opponentName: 'opponent1',
      });

      renderDashboard();

      // Should not show dashboard tabs
      expect(screen.queryByTestId('game-section')).not.toBeInTheDocument();

      // Should show the active game component
      expect(screen.getByTestId('rock-paper-scissors')).toBeInTheDocument();
      expect(screen.getByText(/Refleks Avı/)).toBeInTheDocument();

      // Should show lobby return button (with arrow character ←)
      expect(screen.getByText('← Lobiye Dön')).toBeInTheDocument();
    });

    it('renders Çift Tek Sprint component when active game type matches', () => {
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        activeGameId: 'game456',
        activeGameType: 'Çift Tek Sprint',
        opponentName: 'rakip',
      });

      renderDashboard();

      expect(screen.getByTestId('odd-even-sprint')).toBeInTheDocument();
      expect(screen.getByText(/Çift Tek Sprint - testuser/)).toBeInTheDocument();
    });

    it('renders Bilgi Yarışı component when active game type matches', () => {
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        activeGameId: 'game457',
        activeGameType: 'Bilgi Yarışı',
        opponentName: 'rakip',
      });

      renderDashboard();

      expect(screen.getByTestId('knowledge-quiz')).toBeInTheDocument();
      expect(screen.getByText(/Bilgi Yarışı - testuser/)).toBeInTheDocument();
    });

    it('renders Retro Satranç component when active game type matches', () => {
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        activeGameId: 'game458',
        activeGameType: 'Retro Satranç',
        opponentName: 'rakip',
      });

      renderDashboard();

      expect(screen.getByTestId('retro-chess')).toBeInTheDocument();
      expect(screen.getByText(/Retro Satranç - testuser/)).toBeInTheDocument();
    });

    it('renders Nişancı Düellosu component and processes finish', async () => {
      const mockLeaveGame = jest.fn();
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        activeGameId: 'game789',
        activeGameType: 'Nişancı Düellosu',
        opponentName: 'rakip',
        leaveGame: mockLeaveGame,
      });

      renderDashboard();

      fireEvent.click(screen.getByRole('button', { name: 'Savaşı Bitir' }));

      await waitFor(() => {
        expect(mockOnUpdateUser).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'testuser',
            points: 1010,
            wins: 6,
            gamesPlayed: 11,
          })
        );
        expect(screen.getByText('Maç Sonucu')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Sonucu gördüm, lobiye dön'));

      await waitFor(() => {
        expect(mockLeaveGame).toHaveBeenCalledTimes(1);
      });
    });

    it('returns to lobby from active game screen', () => {
      const mockLeaveGame = jest.fn();
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        activeGameId: 'active1',
        activeGameType: 'Refleks Avı',
        opponentName: 'rakip',
        leaveGame: mockLeaveGame,
      });

      renderDashboard();

      fireEvent.click(screen.getByText('← Lobiye Dön'));
      expect(window.confirm).toHaveBeenCalled();
      return waitFor(() => {
        expect(mockLeaveGame).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Reward Flow', () => {
    it('displays loading state while fetching rewards', () => {
      mockUseRewards.mockReturnValue({
        ...defaultRewardsState,
        rewardsLoading: true,
      });

      renderDashboard();

      expect(screen.getByTestId('rewards-loading')).toHaveTextContent('Loading');
    });

    it('displays rewards when loaded', () => {
      mockUseRewards.mockReturnValue({
        ...defaultRewardsState,
        rewards: [
          { id: 1, title: 'Kahve', cost: 100, icon: 'coffee', description: 'Bir fincan kahve' },
          { id: 2, title: 'Tatlı', cost: 200, icon: 'dessert', description: 'Bir dilim tatlı' },
        ],
      });

      renderDashboard();

      expect(screen.getByTestId('rewards-count')).toHaveTextContent('2');
      expect(screen.getByTestId('buy-reward-1')).toHaveTextContent('Satın Al: Kahve');
      expect(screen.getByTestId('buy-reward-2')).toHaveTextContent('Satın Al: Tatlı');
    });

    it('disables buy button when insufficient points', () => {
      mockUseRewards.mockReturnValue({
        ...defaultRewardsState,
        rewards: [
          { id: 1, title: 'Pahalı Ödül', cost: 2000, icon: 'game', description: 'Çok pahalı' },
        ],
      });

      renderDashboard();

      expect(screen.getByTestId('buy-reward-1')).toBeDisabled();
    });

    it('allows buying reward when sufficient points', async () => {
      const mockBuyReward = jest.fn().mockResolvedValue({
        success: true,
        code: 'COUPON123',
        newPoints: 900
      });
      mockUseRewards.mockReturnValue({
        ...defaultRewardsState,
        rewards: [
          { id: 1, title: 'Kahve', cost: 100, icon: 'coffee', description: 'Bir fincan kahve' },
        ],
        buyReward: mockBuyReward,
      });

      renderDashboard();

      fireEvent.click(screen.getByTestId('buy-reward-1'));

      await waitFor(() => {
        expect(mockBuyReward).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1, title: 'Kahve', cost: 100 })
        );
        expect(mockOnUpdateUser).toHaveBeenCalledWith(
          expect.objectContaining({
            points: 900,
          })
        );
      });
    });

    it('displays inventory count', () => {
      mockUseRewards.mockReturnValue({
        ...defaultRewardsState,
        inventory: [
          { redeemId: '1', id: 1, title: 'Kahve', description: 'Kahve', cost: 100, icon: 'coffee', code: 'ABC', redeemedAt: new Date(), isUsed: false },
          { redeemId: '2', id: 2, title: 'Tatlı', description: 'Tatlı', cost: 200, icon: 'dessert', code: 'DEF', redeemedAt: new Date(), isUsed: false },
        ],
      });

      renderDashboard();

      expect(screen.getByTestId('inventory-tab')).toHaveTextContent('Envanter (2)');
    });

    it('switches between shop and inventory tabs', () => {
      const mockSetActiveTab = jest.fn();
      mockUseRewards.mockReturnValue({
        ...defaultRewardsState,
        setActiveTab: mockSetActiveTab,
      });

      renderDashboard();

      fireEvent.click(screen.getByTestId('inventory-tab'));
      expect(mockSetActiveTab).toHaveBeenCalledWith('inventory');

      fireEvent.click(screen.getByTestId('shop-tab'));
      expect(mockSetActiveTab).toHaveBeenCalledWith('shop');
    });
  });

  describe('User Without Table Connection', () => {
    const userWithoutTable: User = {
      ...mockUser,
      table_number: undefined,
    };

    it('shows not connected status', () => {
      render(
        <ToastProvider>
          <Dashboard
            currentUser={userWithoutTable}
            onUpdateUser={mockOnUpdateUser}
          />
        </ToastProvider>
      );

      expect(screen.getByTestId('match-status')).toHaveTextContent('Not Connected');
    });

    it('disables game buttons when not connected', () => {
      render(
        <ToastProvider>
          <Dashboard
            currentUser={userWithoutTable}
            onUpdateUser={mockOnUpdateUser}
          />
        </ToastProvider>
      );

      expect(screen.getByTestId('create-game-btn')).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('handles game creation error gracefully', async () => {
      const mockCreateGame = jest.fn().mockRejectedValue(new Error('Failed'));
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        createGame: mockCreateGame,
      });

      // Mock alert
      const mockAlert = jest.spyOn(window, 'alert').mockImplementation(() => { });

      renderDashboard();

      fireEvent.click(screen.getByTestId('create-game-btn'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Oyun kurulurken hata oluştu.');
      });

      mockAlert.mockRestore();
    });

    it('handles reward purchase error gracefully', async () => {
      const mockBuyReward = jest.fn().mockRejectedValue(new Error('Insufficient points'));
      mockUseRewards.mockReturnValue({
        ...defaultRewardsState,
        rewards: [
          { id: 1, title: 'Kahve', cost: 100, icon: 'coffee', description: 'Bir fincan kahve' },
        ],
        buyReward: mockBuyReward,
      });

      // Mock alert
      const mockAlert = jest.spyOn(window, 'alert').mockImplementation(() => { });

      renderDashboard();

      fireEvent.click(screen.getByTestId('buy-reward-1'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Insufficient points');
      });

      mockAlert.mockRestore();
    });
  });

  describe('Active Game Rejoin', () => {
    it('shows rejoin banner when has active game on server', () => {
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        serverActiveGame: {
          id: 1,
          gameType: 'Refleks Avı',
          hostName: 'TestHost',
          points: 50,
          table: 'A1',
          status: 'active',
        },
      });

      renderDashboard();

      expect(screen.getByText('🎮 Aktif Oyunun Var!')).toBeInTheDocument();
      expect(screen.getByText('Oyuna Dön')).toBeInTheDocument();
    });

    it('rejoins active game and resolves opponent based on host/guest', () => {
      const mockSetActiveGame = jest.fn();
      mockUseGames.mockReturnValue({
        ...defaultGamesState,
        setActiveGame: mockSetActiveGame,
        serverActiveGame: {
          id: 42,
          gameType: 'Refleks Avı',
          hostName: 'testuser',
          guestName: 'rakipX',
          points: 50,
          table: 'A1',
          status: 'active',
        },
      });

      renderDashboard();

      fireEvent.click(screen.getByText('Oyuna Dön'));
      expect(mockSetActiveGame).toHaveBeenCalledWith(42, 'Refleks Avı', 'rakipX');
    });
  });
});
