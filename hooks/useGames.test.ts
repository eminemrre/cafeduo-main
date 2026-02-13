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
      get: jest.fn(),
      delete: jest.fn(),
    },
    users: {
      getActiveGame: jest.fn(),
      getGameHistory: jest.fn(),
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
    (api.users.getGameHistory as jest.Mock).mockResolvedValue([]);
    (api.games.delete as jest.Mock).mockResolvedValue({ success: true });
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
      { id: 1, hostName: 'user1', gameType: 'Refleks Avı', points: 50, table: 'MASA01', status: 'waiting' },
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

  it('requests all visible lobby games for checked-in users', async () => {
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    renderHook(() =>
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await waitFor(() => {
      expect(api.games.list).toHaveBeenCalledWith({
        tableCode: 'MASA01',
        includeAll: true,
      });
    });
  });

  it('keeps lobby list as returned by API', async () => {
    const mockGames = [
      { id: 1, hostName: 'user1', gameType: 'Refleks Avı', points: 50, table: 'MASA01', status: 'waiting' },
      { id: 2, hostName: 'Unknown', gameType: 'Ritim Kopyala', points: 100, table: 'MASA02', status: 'waiting' },
      { id: 3, hostName: 'unknown', gameType: 'Çift Tek Sprint', points: 150, table: 'MASA03', status: 'waiting' },
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
      expect(result.current.games).toEqual(mockGames);
    });
  });

  it('deduplicates malformed duplicate lobby entries by game id', async () => {
    const duplicatedGames = [
      { id: 7, hostName: 'user1', gameType: 'Refleks Avı', points: 50, table: 'MASA01', status: 'waiting' },
      { id: 7, hostName: 'user1', gameType: 'Refleks Avı', points: 50, table: 'MASA01', status: 'waiting' },
      { id: 8, hostName: 'user2', gameType: 'Ritim Kopyala', points: 80, table: 'MASA02', status: 'waiting' },
    ];
    (api.games.list as jest.Mock).mockResolvedValue(duplicatedGames);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() =>
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await waitFor(() => {
      expect(result.current.games).toHaveLength(2);
    });
    expect(result.current.games.map((game) => game.id)).toEqual([7, 8]);
  });

  it('keeps stable state when API request fails', async () => {
    (api.games.list as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await waitFor(() => {
      expect(api.games.list).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Oyunlar yüklenemedi');
      expect(Array.isArray(result.current.games)).toBe(true);
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
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
      await result.current.createGame('Refleks Avı', 50);
    });

    expect(api.games.create).toHaveBeenCalledWith({
      gameType: 'Refleks Avı',
      points: 50,
      hostName: 'testuser',
      table: 'MASA01',
    });
  });

  it('joinGame calls API and sets active game', async () => {
    const joinedGame = { 
      id: 1, 
      hostName: 'otheruser', 
      gameType: 'Refleks Avı',
      status: 'active'
    };
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);
    (api.games.join as jest.Mock).mockResolvedValue(joinedGame);
    (api.games.get as jest.Mock).mockResolvedValue(joinedGame);

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await act(async () => {
      await result.current.joinGame(1);
    });

    expect(api.games.join).toHaveBeenCalledWith(1, 'testuser');
    expect(api.games.get).toHaveBeenCalledWith(1);
    expect(result.current.activeGameId).toBe(1);
    expect(result.current.opponentName).toBe('otheruser');
  });

  it('uses table_number fallback when tableCode is empty during game creation', async () => {
    const tableUser: User = {
      ...mockUser,
      table_number: 'MASA08',
    };

    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);
    (api.games.create as jest.Mock).mockResolvedValue({ id: 1, success: true });

    const { result } = renderHook(() =>
      useGames({ currentUser: tableUser, tableCode: '' })
    );

    await act(async () => {
      await result.current.createGame('Ritim Kopyala', 75);
    });

    expect(api.games.create).toHaveBeenCalledWith({
      gameType: 'Ritim Kopyala',
      points: 75,
      hostName: 'testuser',
      table: 'MASA08',
    });
  });

  it('falls back to lobby snapshot when joined game detail is partial', async () => {
    const listSnapshot = [
      {
        id: 45,
        hostName: 'lobbyHost',
        gameType: 'Çift Tek Sprint',
        points: 120,
        table: 'MASA02',
        status: 'waiting',
      },
    ];

    (api.games.list as jest.Mock).mockResolvedValue(listSnapshot);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);
    (api.games.join as jest.Mock).mockResolvedValue({ success: true });
    (api.games.get as jest.Mock).mockResolvedValue({ id: 45 }); // Missing hostName/gameType on purpose

    const { result } = renderHook(() =>
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await waitFor(() => {
      expect(result.current.games.length).toBe(1);
    });

    await act(async () => {
      await result.current.joinGame(45);
    });

    expect(result.current.activeGameId).toBe(45);
    expect(result.current.activeGameType).toBe('Çift Tek Sprint');
    expect(result.current.opponentName).toBe('lobbyHost');
  });

  it('does not overwrite local active game with server polling', async () => {
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue({
      id: 99,
      gameType: 'Ritim Kopyala',
    });

    const { result } = renderHook(() =>
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await waitFor(() => {
      expect(api.users.getActiveGame).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.setActiveGame(501, 'Refleks Avı', 'bot-1', true);
    });

    (api.users.getActiveGame as jest.Mock).mockClear();

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(api.users.getActiveGame).not.toHaveBeenCalled();
    expect(result.current.activeGameId).toBe(501);
    expect(result.current.activeGameType).toBe('Refleks Avı');
  });

  it('auto-joins active game returned by server state', async () => {
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock)
      .mockResolvedValueOnce({
        id: 88,
        hostName: 'hostA',
        guestName: 'testuser',
        gameType: 'Refleks Avı',
        table: 'MASA01',
        status: 'active',
      })
      .mockResolvedValue(null);

    const { result } = renderHook(() =>
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.activeGameId).toBe(88);
      expect(result.current.activeGameType).toBe('Refleks Avı');
      expect(result.current.opponentName).toBe('hostA');
      expect(result.current.serverActiveGame).toBeNull();
    });
  });

  it('keeps polling healthy and clears interval on unmount', async () => {
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() =>
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await waitFor(() => {
      expect(api.games.list).toHaveBeenCalledTimes(1);
      expect(api.users.getActiveGame).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect((api.games.list as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect((api.users.getActiveGame as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('setActiveGame updates state', () => {
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    act(() => {
      result.current.setActiveGame(1, 'Refleks Avı', 'opponent123', false);
    });

    expect(result.current.activeGameId).toBe(1);
    expect(result.current.activeGameType).toBe('Refleks Avı');
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
      result.current.setActiveGame(1, 'Refleks Avı', 'opponent', false);
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

  it('cancelGame calls delete endpoint and refreshes game list', async () => {
    (api.games.list as jest.Mock)
      .mockResolvedValueOnce([
        { id: 91, hostName: 'testuser', gameType: 'Refleks Avı', points: 25, table: 'MASA01', status: 'waiting' },
      ])
      .mockResolvedValueOnce([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() =>
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await waitFor(() => {
      expect(result.current.games.length).toBe(1);
    });

    await act(async () => {
      await result.current.cancelGame(91);
    });

    expect(api.games.delete).toHaveBeenCalledWith(91);
    await waitFor(() => {
      expect(result.current.games.length).toBe(0);
    });
  });

  it('cancelGame tolerates already-removed game responses', async () => {
    (api.games.list as jest.Mock)
      .mockResolvedValueOnce([
        { id: 99, hostName: 'testuser', gameType: 'Refleks Avı', points: 25, table: 'MASA01', status: 'waiting' },
      ])
      .mockResolvedValueOnce([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);
    (api.games.delete as jest.Mock).mockRejectedValueOnce(new Error('Oyun bulunamadı veya silme yetkiniz yok.'));

    const { result } = renderHook(() =>
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await waitFor(() => {
      expect(result.current.games.length).toBe(1);
    });

    await act(async () => {
      await result.current.cancelGame(99);
    });

    expect(api.games.delete).toHaveBeenCalledWith(99);
    await waitFor(() => {
      expect(result.current.games.length).toBe(0);
    });
  });

  it('refetch calls fetchGames and checkActiveGame', async () => {
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => 
      useGames({ currentUser: mockUser, tableCode: mockTableCode })
    );

    await waitFor(() => {
      expect(api.games.list).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect((api.games.list as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(api.users.getActiveGame).toHaveBeenCalledWith('testuser');
  });
});
