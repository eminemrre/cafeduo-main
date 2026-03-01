import { api } from './api';

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('API Layer additional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('verifyToken calls /auth/me with cookie credentials', async () => {
    const mockUser = { id: 2, email: 'cookie@example.com' };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    });

    const result = await api.auth.verifyToken();

    expect(result).toEqual(mockUser);
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('verifyToken returns null on fetch failure', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const result = await api.auth.verifyToken();

    expect(result).toBeNull();
    expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('token');
  });

  it('users.get returns null on request error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    await expect(api.users.get('404')).resolves.toBeNull();
  });

  it('cafes.checkIn sends expected payload', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await api.cafes.checkIn({ cafeId: 7, tableNumber: 3, latitude: 37.741, longitude: 29.101, accuracy: 12 });

    expect(fetch).toHaveBeenCalledWith(
      '/api/cafes/7/check-in',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ cafeId: 7, tableNumber: 3, latitude: 37.741, longitude: 29.101, accuracy: 12 }),
      })
    );
  });

  it('rewards.list appends cafeId query when provided', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    await api.rewards.list(9);

    expect(fetch).toHaveBeenCalledWith(
      '/api/rewards?cafeId=9',
      expect.any(Object)
    );
  });

  it('admin.updateUserRole sends role with optional cafe id', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await api.admin.updateUserRole(5, 'cafe_admin', 2);

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/users/5/role',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ role: 'cafe_admin', cafe_id: 2 }),
      })
    );
  });

  it('admin user management wrappers call expected endpoints', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 11 }) }) // create user
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 11, points: 777 }) }) // update points
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }); // delete user

    await api.admin.createUser({
      username: 'new-user',
      email: 'new-user@test.com',
      password: 'secret123',
      role: 'user',
    });
    await api.admin.updateUserPoints(11, 777);
    await api.admin.deleteUser(11);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/admin/users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          username: 'new-user',
          email: 'new-user@test.com',
          password: 'secret123',
          role: 'user',
        }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/admin/users/11/points',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ points: 777 }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/admin/users/11',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('shop.buy sends reward id only', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, newPoints: 100 }),
    });

    await api.shop.buy(42);

    expect(fetch).toHaveBeenCalledWith(
      '/api/shop/buy',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rewardId: 42 }),
      })
    );
  });

  it('coupons.use posts code payload', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await api.coupons.use('ABC');

    expect(fetch).toHaveBeenCalledWith(
      '/api/coupons/use',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'ABC' }),
      })
    );
  });

  it('throws HTTP status when error body is not json/text', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('bad json');
      },
    });

    await expect(api.games.list()).rejects.toThrow('HTTP 500');
  });

  it('surfaces plain-text rate-limit message and retry hint', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => {
        throw new Error('not json');
      },
      text: async () => 'Çok fazla istek gönderdiniz, lütfen daha sonra tekrar deneyin.',
      headers: {
        get: (name: string) => (name.toLowerCase() === 'retry-after' ? '120' : null),
      },
    });

    await expect(api.auth.login('test@example.com', 'wrongpass')).rejects.toThrow(
      'Çok fazla istek gönderdiniz, lütfen daha sonra tekrar deneyin. 120 sn sonra tekrar deneyin.'
    );
  });

  it('onGameChange polls and unsubscribe stops further polling', async () => {
    const setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockImplementation((fn: TimerHandler) => {
        (fn as Function)();
        return 123 as unknown as NodeJS.Timeout;
      });
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});

    const getSpy = jest.spyOn(api.games, 'get').mockResolvedValue({ id: 1, status: 'playing' } as any);
    const callback = jest.fn();

    const unsubscribe = api.games.onGameChange('1', callback);
    await flush();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2000);

    unsubscribe();
    expect(clearIntervalSpy).toHaveBeenCalledWith(123);

    getSpy.mockRestore();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('users.getActiveGame calls dedicated active-game endpoint', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, hostName: 'emin', status: 'active' }),
    });

    const result = await api.users.getActiveGame('emin');

    expect(result).toEqual(expect.objectContaining({ id: 1, status: 'active' }));
    expect(fetch).toHaveBeenCalledWith('/api/users/emin/active-game', expect.any(Object));
  });

  it('users.getActiveGame returns null when endpoint fails', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    const result = await api.users.getActiveGame('emin');
    expect(result).toBeNull();
  });

  it('cafes.get returns null on API error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });

    await expect(api.cafes.get('1')).resolves.toBeNull();
  });

  it('games CRUD wrappers send expected endpoints', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 11 }) }) // get
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 12 }) }) // create
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 12 }) }) // join
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }) // move
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }) // finish
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }) // submitScore
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }); // delete

    await api.games.get(11);
    await api.games.create({ gameType: 'Refleks Avı', points: 50 });
    await api.games.join(12, 'guest');
    await api.games.move(12, { gameState: { turn: 1 } });
    await api.games.finish(12, 'emin');
    await api.games.submitScore(12, { username: 'emin', score: 3, roundsWon: 3 });
    await api.games.delete(12);

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/games/11', expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/games', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/games/12/join',
      expect.objectContaining({ body: JSON.stringify({ guestName: 'guest' }) })
    );
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/games/12/move', expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(5, '/api/games/12/finish', expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(
      6,
      '/api/games/12/move',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ scoreSubmission: { username: 'emin', score: 3, roundsWon: 3 } }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(7, '/api/games/12', expect.objectContaining({ method: 'DELETE' }));
  });

  it('onLobbyChange polls and unsubscribe clears interval', async () => {
    const setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockImplementation((fn: TimerHandler) => {
        (fn as Function)();
        return 456 as unknown as NodeJS.Timeout;
      });
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
    const listSpy = jest.spyOn(api.games, 'list').mockResolvedValue([{ id: 1 }] as any);
    const callback = jest.fn();

    const unsubscribe = api.games.onLobbyChange(callback);
    await flush();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 3000);

    unsubscribe();
    expect(clearIntervalSpy).toHaveBeenCalledWith(456);

    listSpy.mockRestore();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('rewards and inventory wrappers call expected endpoints', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 90 }) }) // rewards.create
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }) // rewards.delete
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'inv1' }] }); // inventory

    await api.rewards.create({ title: 'X', cost: 10, description: 'D', icon: 'coffee' });
    await api.rewards.delete(90);
    await api.shop.inventory(1);

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/rewards', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/rewards/90', expect.objectContaining({ method: 'DELETE' }));
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/shop/inventory/1', expect.any(Object));
  });

  it('leaderboard and admin wrappers call expected endpoints', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // leaderboard
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // admin users
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // admin games
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }) // update cafe
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 5 }) }) // create cafe
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }); // delete cafe

    await api.leaderboard.get();
    await api.admin.getUsers();
    await api.admin.getGames();
    await api.admin.updateCafe(2, { name: 'Yeni Kafe' });
    await api.admin.createCafe({ name: 'A Kafe' });
    await api.admin.deleteCafe(2);

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/leaderboard', expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/admin/users', expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/admin/games', expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/admin/cafes/2', expect.objectContaining({ method: 'PUT' }));
    expect(fetch).toHaveBeenNthCalledWith(5, '/api/admin/cafes', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(6, '/api/admin/cafes/2', expect.objectContaining({ method: 'DELETE' }));
  });
});
