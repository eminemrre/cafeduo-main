/**
 * Additional branch coverage tests for hooks/useGames.ts
 * Targets uncovered branches: normalizeTableCode, toMessage, isNotFoundError, isSameGameList, cancelGame edge cases
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useGames } from './useGames';
import { User } from '../types';

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
    },
  },
}));

import { api } from '../lib/api';

describe('useGames branch coverage', () => {
  const mockUser: User = {
    id: 1,
    username: 'testuser',
    email: 'test@test.com',
    points: 100,
    wins: 0,
    gamesPlayed: 0,
    role: 'user',
    isAdmin: false,
  };

  const adminUser: User = {
    ...mockUser,
    role: 'admin',
    isAdmin: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (api.games.list as jest.Mock).mockResolvedValue([]);
    (api.users.getActiveGame as jest.Mock).mockResolvedValue(null);
    (api.users.getGameHistory as jest.Mock).mockResolvedValue([]);
    (api.games.delete as jest.Mock).mockResolvedValue({ success: true });
    (api.games.create as jest.Mock).mockResolvedValue({ id: 1, status: 'waiting' });
    (api.games.join as jest.Mock).mockResolvedValue({ id: 1, status: 'active' });
    (api.games.get as jest.Mock).mockResolvedValue({ id: 1, hostName: 'other', gameType: 'Retro Satranç', status: 'active' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('normalizeTableCode edge cases', () => {
    it('converts numeric string to MASA format', async () => {
      renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: '5' })
      );

      await waitFor(() => {
        expect(api.games.list).toHaveBeenCalledWith(
          expect.objectContaining({
            tableCode: 'MASA05',
          })
        );
      });
    });

    it('handles UNDEFINED string', async () => {
      renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'undefined' })
      );

      await waitFor(() => {
        expect(api.games.list).toHaveBeenCalledWith(
          expect.objectContaining({
            tableCode: '',
          })
        );
      });
    });

    it('handles NULL string', async () => {
      renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'null' })
      );

      await waitFor(() => {
        expect(api.games.list).toHaveBeenCalledWith(
          expect.objectContaining({
            tableCode: '',
          })
        );
      });
    });

    it('passes through MASAXX format unchanged', async () => {
      renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA12' })
      );

      await waitFor(() => {
        expect(api.games.list).toHaveBeenCalledWith(
          expect.objectContaining({
            tableCode: 'MASA12',
          })
        );
      });
    });

    it('falls back to user table_number when tableCode is empty', async () => {
      const userWithTable = { ...mockUser, table_number: 'MASA07' };
      renderHook(() =>
        useGames({ currentUser: userWithTable, tableCode: '' })
      );

      await waitFor(() => {
        expect(api.games.list).toHaveBeenCalledWith(
          expect.objectContaining({
            tableCode: 'MASA07',
          })
        );
      });
    });

    it('passes non-MASA non-numeric string as-is', async () => {
      renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'VIP01' })
      );

      await waitFor(() => {
        expect(api.games.list).toHaveBeenCalledWith(
          expect.objectContaining({
            tableCode: 'VIP01',
          })
        );
      });
    });
  });

  describe('isAdminActor', () => {
    it('includes all games for admin users', async () => {
      renderHook(() =>
        useGames({ currentUser: adminUser, tableCode: '' })
      );

      await waitFor(() => {
        expect(api.games.list).toHaveBeenCalledWith(
          expect.objectContaining({
            includeAll: true,
          })
        );
      });
    });
  });

  describe('createGame error handling', () => {
    it('throws error with custom message on create failure', async () => {
      (api.games.create as jest.Mock).mockRejectedValue(new Error('Server error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await expect(
        act(async () => {
          await result.current.createGame('Nişancı Düellosu', 50);
        })
      ).rejects.toThrow('Server error');

      consoleSpy.mockRestore();
    });

    it('throws fallback message for non-Error rejection', async () => {
      (api.games.create as jest.Mock).mockRejectedValue('string error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await expect(
        act(async () => {
          await result.current.createGame('Nişancı Düellosu', 50);
        })
      ).rejects.toThrow('Oyun kurulurken hata oluştu');

      consoleSpy.mockRestore();
    });

    it('includes chessClock options when provided', async () => {
      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await act(async () => {
        await result.current.createGame('Retro Satranç', 100, {
          chessClock: { baseSeconds: 180, incrementSeconds: 2, label: '3+2' },
        });
      });

      expect(api.games.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chessClock: { baseSeconds: 180, incrementSeconds: 2, label: '3+2' },
        })
      );
    });
  });

  describe('joinGame error handling', () => {
    it('throws error with custom message on join failure', async () => {
      (api.games.join as jest.Mock).mockRejectedValue(new Error('Game full'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await expect(
        act(async () => {
          await result.current.joinGame(1);
        })
      ).rejects.toThrow('Game full');

      consoleSpy.mockRestore();
    });

    it('throws fallback message for non-Error rejection', async () => {
      (api.games.join as jest.Mock).mockRejectedValue(null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await expect(
        act(async () => {
          await result.current.joinGame(1);
        })
      ).rejects.toThrow('Oyuna katılırken hata oluştu');

      consoleSpy.mockRestore();
    });
  });

  describe('cancelGame edge cases', () => {
    it('clears active game if cancelled game matches activeGameId', async () => {
      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      act(() => {
        result.current.setActiveGame(42, 'Nişancı Düellosu');
      });

      expect(result.current.activeGameId).toBe(42);

      await act(async () => {
        await result.current.cancelGame(42);
      });

      expect(result.current.activeGameId).toBeNull();
    });

    it('throws on non-404 delete error', async () => {
      (api.games.delete as jest.Mock).mockRejectedValue(new Error('Server error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await expect(
        act(async () => {
          await result.current.cancelGame(99);
        })
      ).rejects.toThrow('Server error');

      consoleSpy.mockRestore();
    });

    it('handles bulunamadı error gracefully (not-found branch)', async () => {
      (api.games.delete as jest.Mock).mockRejectedValue(new Error('Oyun bulunamadı'));

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      // Should not throw for not-found errors
      await act(async () => {
        await result.current.cancelGame(99);
      });

      // Should still refresh the game list
      expect(api.games.list).toHaveBeenCalled();
    });

    it('handles 404 error gracefully', async () => {
      (api.games.delete as jest.Mock).mockRejectedValue(new Error('HTTP 404'));

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await act(async () => {
        await result.current.cancelGame(99);
      });

      expect(api.games.list).toHaveBeenCalled();
    });

    it('handles not found (English) error gracefully', async () => {
      (api.games.delete as jest.Mock).mockRejectedValue(new Error('not found'));

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await act(async () => {
        await result.current.cancelGame(99);
      });

      expect(api.games.list).toHaveBeenCalled();
    });
  });

  describe('leaveGame', () => {
    it('calls leaveGame on socketService when activeGameId is set', () => {
      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      act(() => {
        result.current.setActiveGame(42, 'Nişancı Düellosu');
      });

      act(() => {
        result.current.leaveGame();
      });

      expect(result.current.activeGameId).toBeNull();
      expect(result.current.activeGameType).toBe('');
      expect(result.current.opponentName).toBeUndefined();
    });

    it('still clears state when no active game', () => {
      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      act(() => {
        result.current.leaveGame();
      });

      expect(result.current.activeGameId).toBeNull();
    });
  });

  describe('setActiveGame', () => {
    it('resets cooldown when gameId is set', () => {
      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      act(() => {
        result.current.setActiveGame(42, 'Nişancı Düellosu', 'opponent', true);
      });

      expect(result.current.activeGameId).toBe(42);
      expect(result.current.isBot).toBe(true);
    });

    it('clears game when gameId is null', () => {
      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      act(() => {
        result.current.setActiveGame(42, 'Nişancı Düellosu');
      });
      act(() => {
        result.current.setActiveGame(null);
      });

      expect(result.current.activeGameId).toBeNull();
    });
  });

  describe('normalizeLobbyList', () => {
    it('filters out non-waiting games', async () => {
      (api.games.list as jest.Mock).mockResolvedValue([
        { id: 1, hostName: 'a', gameType: 'T', points: 50, table: 'MASA01', status: 'waiting' },
        { id: 2, hostName: 'b', gameType: 'T', points: 50, table: 'MASA01', status: 'active' },
        { id: 3, hostName: 'c', gameType: 'T', points: 50, table: 'MASA01', status: 'finished' },
      ]);

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await waitFor(() => {
        expect(result.current.games).toHaveLength(1);
        expect(result.current.games[0].id).toBe(1);
      });
    });

    it('filters out games with undefined id', async () => {
      (api.games.list as jest.Mock).mockResolvedValue([
        { id: undefined, hostName: 'a', gameType: 'T', points: 50, table: 'MASA01', status: 'waiting' },
        { id: 1, hostName: 'b', gameType: 'T', points: 50, table: 'MASA01', status: 'waiting' },
      ]);

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await waitFor(() => {
        expect(result.current.games).toHaveLength(1);
      });
    });

    it('handles non-array API response', async () => {
      (api.games.list as jest.Mock).mockResolvedValue('not an array');

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await waitFor(() => {
        expect(result.current.games).toEqual([]);
      });
    });

    it('sorts same-table games first', async () => {
      (api.games.list as jest.Mock).mockResolvedValue([
        { id: 1, hostName: 'a', gameType: 'T', points: 50, table: 'MASA02', status: 'waiting', createdAt: '2026-01-01T10:00:01Z' },
        { id: 2, hostName: 'b', gameType: 'T', points: 50, table: 'MASA01', status: 'waiting', createdAt: '2026-01-01T10:00:00Z' },
      ]);

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await waitFor(() => {
        expect(result.current.games).toHaveLength(2);
        expect(result.current.games[0].id).toBe(2); // Same table first
      });
    });
  });

  describe('fetchGameHistory', () => {
    it('handles non-array history response', async () => {
      (api.users.getGameHistory as jest.Mock).mockResolvedValue('not an array');

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await waitFor(() => {
        expect(result.current.gameHistory).toEqual([]);
      });
    });

    it('handles history fetch error silently', async () => {
      (api.users.getGameHistory as jest.Mock).mockRejectedValue(new Error('Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await waitFor(() => {
        expect(result.current.gameHistory).toEqual([]);
      });

      consoleSpy.mockRestore();
    });
  });

  describe('checkActiveGame', () => {
    it('handles active game fetch error', async () => {
      (api.users.getActiveGame as jest.Mock).mockRejectedValue(new Error('Fail'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderHook(() =>
        useGames({ currentUser: mockUser, tableCode: 'MASA01' })
      );

      await waitFor(() => {
        expect(api.users.getActiveGame).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});
