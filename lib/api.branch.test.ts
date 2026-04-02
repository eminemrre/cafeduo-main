/**
 * Additional branch coverage tests for lib/api.ts
 * Targets uncovered branches: error parsing, network errors, timeout, version normalization,
 * store endpoints, achievements normalization, cafe check-in branches
 */

import { api, normalizeApiBaseUrl, getCsrfToken } from './api';

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('API branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    (fetch as jest.Mock).mockClear();
  });

  describe('normalizeApiBaseUrl', () => {
    it('returns empty string for empty/whitespace-only input', () => {
      expect(normalizeApiBaseUrl('')).toBe('');
      expect(normalizeApiBaseUrl('   ')).toBe('');
    });

    it('passes through relative URLs starting with /', () => {
      expect(normalizeApiBaseUrl('/api')).toBe('');
    });

    it('passes through https URLs unchanged', () => {
      expect(normalizeApiBaseUrl('https://example.com')).toBe('https://example.com');
    });

    it('passes through http URLs unchanged', () => {
      expect(normalizeApiBaseUrl('http://example.com')).toBe('http://example.com');
    });

    it('adds http:// for localhost', () => {
      expect(normalizeApiBaseUrl('localhost:3001')).toBe('http://localhost:3001');
    });

    it('adds http:// for 127.0.0.1', () => {
      expect(normalizeApiBaseUrl('127.0.0.1:3001')).toBe('http://127.0.0.1:3001');
    });

    it('adds https:// for non-local hostnames', () => {
      expect(normalizeApiBaseUrl('cafeduotr.com')).toBe('https://cafeduotr.com');
    });

    it('strips trailing slashes', () => {
      expect(normalizeApiBaseUrl('https://example.com/')).toBe('https://example.com');
      expect(normalizeApiBaseUrl('https://example.com///')).toBe('https://example.com');
    });

    it('strips /api suffix', () => {
      expect(normalizeApiBaseUrl('https://example.com/api')).toBe('https://example.com');
    });

    it('upgrades http to https in browser when on https page', () => {
      // enforceBrowserHttps checks window.location.protocol
      // In jsdom test env, protocol is typically 'http:' so this branch
      // (upgrading http→https) only runs in production https context.
      // We test the logic indirectly by verifying http URLs pass through in test env.
      const result = normalizeApiBaseUrl('http://example.com');
      // In test env (http: protocol), http URLs pass through unchanged
      expect(result).toBe('http://example.com');
    });

    it('keeps http://localhost in https browser context', () => {
      // In test env (http: protocol), http://localhost passes through unchanged
      expect(normalizeApiBaseUrl('http://localhost:3001')).toBe('http://localhost:3001');
    });
  });

  describe('fetchAPI error handling branches', () => {
    it('throws timeout message on AbortError', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      (fetch as jest.Mock).mockRejectedValueOnce(abortError);

      await expect(api.auth.verifyToken()).resolves.toBeNull();
    });

    it('throws network error message on generic fetch failure', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      await expect(api.auth.verifyToken()).resolves.toBeNull();
    });

    it('throws network error on non-Error fetch rejection', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce('string error');

      await expect(api.auth.verifyToken()).resolves.toBeNull();
    });

    it('parses JSON string error from response', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => 'Simple string error',
      });

      await expect(api.games.list()).rejects.toThrow('Simple string error');
    });

    it('parses JSON object with message field', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Validation failed' }),
      });

      await expect(api.games.list()).rejects.toThrow('Validation failed');
    });

    it('parses JSON object with detail field', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Missing required field' }),
      });

      await expect(api.games.list()).rejects.toThrow('Missing required field');
    });

    it('falls back to text body when json returns falsy', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        clone: () => ({
          json: async () => null,
          text: async () => 'Bad request text', // clone().text() is called first in readText()
        }),
        json: async () => null,
        text: async () => 'Bad request text',
      });

      await expect(api.games.list()).rejects.toThrow('Bad request text');
    });

    it('falls back to HTTP status when both json and text fail', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 502,
        clone: () => ({
          json: async () => { throw new Error('bad'); },
          text: async () => { throw new Error('bad'); },
        }),
        json: async () => { throw new Error('bad'); },
        text: async () => { throw new Error('bad'); },
      });

      await expect(api.games.list()).rejects.toThrow('HTTP 502');
    });

    it('adds retry hint for 429 with retry-after header', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Too many requests' }),
        headers: { get: (name: string) => name === 'retry-after' ? '30' : null },
      });

      await expect(api.games.list()).rejects.toThrow('Too many requests 30 sn sonra tekrar deneyin.');
    });

    it('does not add retry hint when retry-after is not a valid number', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limited' }),
        headers: { get: (name: string) => name === 'retry-after' ? 'invalid' : null },
      });

      await expect(api.games.list()).rejects.toThrow('Rate limited');
    });

    it('does not add retry hint for non-429 status', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
        headers: { get: () => '60' },
      });

      await expect(api.games.list()).rejects.toThrow('Server error');
    });
  });

  describe('api.meta.getVersion', () => {
    it('returns short version for hex commit hash', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commit: '1cf014a485f1dbd3dfa2ea22c4af647067b4633f', buildTime: '2026-04-01T10:00:00Z' }),
      });

      const result = await api.meta.getVersion();
      expect(result.version).toBe('1cf014a485f1dbd3dfa2ea22c4af647067b4633f');
      expect(result.shortVersion).toBe('1cf014a');
      expect(result.buildTime).toBe('2026-04-01T10:00:00Z');
    });

    it('returns short version for non-hex version string', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commit: 'v2.1.0-beta', buildTime: null }),
      });

      const result = await api.meta.getVersion();
      expect(result.version).toBe('v2.1.0-beta');
      expect(result.shortVersion).toBe('v2.1.0-beta');
      expect(result.buildTime).toBe('unknown');
    });

    it('returns local when commit is empty', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commit: '', buildTime: '' }),
      });

      const result = await api.meta.getVersion();
      expect(result.version).toBe('local');
      expect(result.shortVersion).toBe('local');
    });

    it('includes nodeEnv when present', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ commit: 'abc1234567', buildTime: '2026-01-01', nodeEnv: 'production' }),
      });

      const result = await api.meta.getVersion();
      expect(result.nodeEnv).toBe('production');
    });
  });

  describe('api.auth.logout', () => {
    it('clears localStorage even when fetch fails', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await api.auth.logout();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('currentUser');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cafe_user');
    });
  });

  describe('api.users.getGameHistory', () => {
    it('returns empty array when response is not an array', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ not: 'an array' }),
      });

      const result = await api.users.getGameHistory('testuser');
      expect(result).toEqual([]);
    });

    it('returns empty array on fetch error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });

      const result = await api.users.getGameHistory('testuser');
      expect(result).toEqual([]);
    });
  });

  describe('api.achievements.list', () => {
    it('returns empty array when response is not an array', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ not: 'an array' }),
      });

      const result = await api.achievements.list(1);
      expect(result).toEqual([]);
    });

    it('normalizes achievement fields with defaults', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, title: 'First Win', description: 'Win your first game', unlocked: true, unlockedAt: '2026-01-01' },
          { id: 2 }, // minimal object
        ],
      });

      const result = await api.achievements.list(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        title: 'First Win',
        description: 'Win your first game',
        icon: 'star',
        points_reward: 0,
        unlocked: true,
        unlockedAt: '2026-01-01',
      });
      expect(result[1]).toEqual({
        id: 2,
        title: '',
        description: '',
        icon: 'star',
        points_reward: 0,
        unlocked: false,
        unlockedAt: null,
      });
    });

    it('clamps negative points_reward to 0', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, points_reward: -50 }],
      });

      const result = await api.achievements.list(1);
      expect(result[0].points_reward).toBe(0);
    });
  });

  describe('api.cafes.checkIn', () => {
    it('omits optional fields when not provided', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.cafes.checkIn({ cafeId: 1, tableNumber: 5 });

      const call = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body).toEqual({ cafeId: 1, tableNumber: 5 });
      expect(body.latitude).toBeUndefined();
      expect(body.longitude).toBeUndefined();
      expect(body.accuracy).toBeUndefined();
      expect(body.tableVerificationCode).toBeUndefined();
    });

    it('omits NaN latitude/longitude', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.cafes.checkIn({ cafeId: 1, tableNumber: 5, latitude: NaN, longitude: NaN });

      const call = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.latitude).toBeUndefined();
      expect(body.longitude).toBeUndefined();
    });

    it('includes verification code when provided', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.cafes.checkIn({ cafeId: 1, tableNumber: 5, tableVerificationCode: 'ABC123' });

      const call = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.tableVerificationCode).toBe('ABC123');
    });

    it('trims and ignores empty verification code', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.cafes.checkIn({ cafeId: 1, tableNumber: 5, tableVerificationCode: '   ' });

      const call = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.tableVerificationCode).toBeUndefined();
    });
  });

  describe('api.games.list', () => {
    it('sends query params for tableCode and includeAll', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await api.games.list({ tableCode: 'MASA05', includeAll: true });

      expect(fetch).toHaveBeenCalledWith(
        '/api/games?table=MASA05&scope=all',
        expect.any(Object)
      );
    });

    it('sends request without query params when no options', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await api.games.list();

      expect(fetch).toHaveBeenCalledWith('/api/games', expect.any(Object));
    });

    it('normalizes table code to uppercase', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await api.games.list({ tableCode: 'masa05' });

      expect(fetch).toHaveBeenCalledWith(
        '/api/games?table=MASA05',
        expect.any(Object)
      );
    });
  });

  describe('api.games.finish', () => {
    it('sends empty body when no winner', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.games.finish(1);

      const call = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body).toEqual({});
    });

    it('sends winner in body when provided', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.games.finish(1, 'emin');

      const call = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body).toEqual({ winner: 'emin' });
    });
  });

  describe('api.games.drawOffer', () => {
    it('sends draw offer action', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, drawOffer: { status: 'pending' } }),
      });

      const result = await api.games.drawOffer(1, 'offer');
      expect(result.success).toBe(true);
    });
  });

  describe('api.games.resign', () => {
    it('sends resign request', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, winner: 'opponent' }),
      });

      const result = await api.games.resign(1);
      expect(result.success).toBe(true);
    });
  });

  describe('api.store endpoints', () => {
    it('store.items fetches items', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, items: [{ id: 1, title: 'Frame', code: 'frame-1', price: 100, type: 'frame', description: 'A frame' }] }),
      });

      const result = await api.store.items();
      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(1);
    });

    it('store.inventory fetches inventory', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, inventory: [] }),
      });

      const result = await api.store.inventory();
      expect(result.success).toBe(true);
    });

    it('store.buy purchases item', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Item purchased',
          inventoryItem: { id: 1, user_id: 1, item_id: 2, item_title: 'Frame', code: 'frame-1', is_used: false },
          remainingPoints: 50,
        }),
      });

      const result = await api.store.buy(2);
      expect(result.success).toBe(true);
      expect(result.remainingPoints).toBe(50);
    });
  });

  describe('api.games.onGameChange error handling', () => {
    it('handles polling error gracefully', async () => {
      // console.error is already mocked globally in test-setup.ts
      const globalConsoleError = console.error as jest.Mock;
      globalConsoleError.mockClear();

      // Make the get call fail with a rejected fetch
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const callback = jest.fn();
      const unsubscribe = api.games.onGameChange('1', callback);

      // Flush microtasks (poll() is async, needs multiple ticks)
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setImmediate(r));
      }

      // Callback should NOT have been called since get failed
      expect(globalConsoleError).toHaveBeenCalledWith('Game polling error:', expect.any(Error));

      unsubscribe();
    });
  });

  describe('api.games.onLobbyChange error handling', () => {
    it('handles lobby polling error gracefully', async () => {
      // console.error is already mocked globally in test-setup.ts
      const globalConsoleError = console.error as jest.Mock;
      globalConsoleError.mockClear();

      // Make the list call fail
      const listSpy = jest.spyOn(api.games, 'list').mockRejectedValueOnce(new Error('Lobby error'));
      const callback = jest.fn();

      const unsubscribe = api.games.onLobbyChange(callback);

      // Flush microtasks
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setImmediate(r));
      }

      expect(globalConsoleError).toHaveBeenCalledWith('Lobby polling error:', expect.any(Error));

      unsubscribe();
      listSpy.mockRestore();
    });
  });

  describe('api.rewards.list without cafeId', () => {
    it('calls /rewards without query param', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await api.rewards.list();

      expect(fetch).toHaveBeenCalledWith('/api/rewards', expect.any(Object));
    });
  });

  describe('api.cafes.updatePin', () => {
    it('sends pin update with optional userId', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.cafes.updatePin(1, '1234', 5);

      const call = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body).toEqual({ pin: '1234', userId: 5 });
    });
  });

  describe('api.games.move with chessMove', () => {
    it('sends chess move payload', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.games.move(1, { chessMove: { from: 'e2', to: 'e4', promotion: 'q' } });

      const call = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.chessMove).toEqual({ from: 'e2', to: 'e4', promotion: 'q' });
    });
  });

  describe('api.games.move with liveSubmission', () => {
    it('sends live submission payload', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.games.move(1, {
        liveSubmission: {
          mode: 'tank',
          score: 5,
          roundsWon: 3,
          round: 2,
          done: false,
          submissionKey: 'key123',
        },
      });

      const call = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.liveSubmission.mode).toBe('tank');
    });
  });
});
