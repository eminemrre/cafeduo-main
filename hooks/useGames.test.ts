import { renderHook, act, waitFor } from '@testing-library/react';
import { useGames } from './useGames';
import { User } from '../types';

// Mock api
jest.mock('../lib/api', () => ({
  api: {
    games: {
      list: jest.fn(),
      create: jest.fn(),
      join: jest.fn(),
    },
    users: {
      getActiveGame: jest.fn(),
    }
  }
}));

import { api } from '../lib/api';

describe('useGames', () => {
  const mockUser: User = { 
    id: 1, 
    username: 'testuser', 
    email: 'test@test.com',
    points: 100,
    wins: 0,
    gamesPlayed: 0,
    role: 'user',
    isAdmin: false
  };
  const mockTableCode = 'MASA01';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initial state', () => {
    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    expect(result.current.games).toEqual([]);
    expect(result.current.loading).toBe(true); // Loading starts as true
    expect(result.current.activeGameId).toBeNull();
    expect(result.current.activeGameType).toBe('');
    expect(result.current.opponentName).toBeUndefined();
  });

  it('fetches games on mount', async () => {
    const mockGames = [
      { id: 1, hostName: 'user1', gameType: 'Taş Kağıt Makas', points: 50, table: 'MASA01', status: 'waiting' },
    ];
    (api.games.list as jest.Mock).mockResolvedValue(mockGames);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    // Wait for useEffect to run
    await waitFor(() => {
      expect(api.games.list).toHaveBeenCalled();
    });

    // Fast-forward timers
    act(() => {
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.games).toEqual(mockGames);
    });
  });

  it('filters out unknown users', async () => {
    const mockGames = [
      { id: 1, hostName: 'user1', gameType: 'Taş Kağıt Makas', points: 50, table: 'MASA01', status: 'waiting' },
      { id: 2, hostName: 'Unknown', gameType: 'Arena', points: 100, table: 'MASA02', status: 'waiting' },
      { id: 3, hostName: 'unknown', gameType: 'Zindan', points: 150, table: 'MASA03', status: 'waiting' },
    ];
    (api.games.list as jest.Mock).mockResolvedValue(mockGames);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await waitFor(() => {
      expect(api.games.list).toHaveBeenCalled();
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      // Only 1 game should remain (filters out 'Unknown' and 'unknown')
      expect(result.current.games.length).toBe(1);
      expect(result.current.games[0].hostName).toBe('user1');
    });
  });

  it('handles API error', async () => {
    (api.games.list as jest.Mock).mockRejectedValue(new Error('Network error'));
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await waitFor(() => {
      expect(api.games.list).toHaveBeenCalled();
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Oyunlar yüklenemedi');
      expect(result.current.games).toEqual([]);
    });
  });

  it('createGame calls API', async () => {
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);
    (api.games.create as jest.Mock).mockResolvedValue({ id: 1, success: true });

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await act(async () => {
      await result.current.createGame('Taş Kağıt Makas', 50);
    });

    expect(api.games.create).toHaveBeenCalledWith({
      gameType: 'Taş Kağıt Makas',
      points: 50,
      hostName: 'testuser',
      table: 'MASA01',
    });
  });

  it('joinGame calls API and sets active game', async () => {
    const joinedGame = { 
      id: 1, 
      hostName: 'otheruser', 
      gameType: 'Taş Kağıt Makas',
      status: 'active'
    };
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);
    (api.games.join as jest.Mock).mockResolvedValue(joinedGame);

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await act(async () => {
      await result.current.joinGame(1);
    });

    expect(api.games.join).toHaveBeenCalledWith(1, 'testuser');
  });

  it('setActiveGame updates state', () => {
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    act(() => {
      result.current.setActiveGame(1, 'Taş Kağıt Makas', 'opponent123', false);
    });

    expect(result.current.activeGameId).toBe(1);
    expect(result.current.activeGameType).toBe('Taş Kağıt Makas');
    expect(result.current.opponentName).toBe('opponent123');
    expect(result.current.isBot).toBe(false);
  });

  it('leaveGame clears state', () => {
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    // Set active game first
    act(() => {
      result.current.setActiveGame(1, 'Taş Kağıt Makas', 'opponent', false);
    });

    expect(result.current.activeGameId).toBe(1);

    // Leave game
    act(() => {
      result.current.leaveGame();
    });

    expect(result.current.activeGameId).toBeNull();
    expect(result.current.activeGameType).toBe('');
    expect(result.current.opponentName).toBeUndefined();
  });

  it('refetch calls fetchGames and checkActiveGame', async () => {
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await act(async () => {
      await result.current.refetch();
    });

    expect(api.games.list).toHaveBeenCalledTimes(2); // Initial + refetch
    expect(api.users.getActiveGame).toHaveBeenCalledWith('testuser');
  });
});
