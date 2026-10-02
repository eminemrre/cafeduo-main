const { createProfileHandlers } = require('./profileHandlers');

const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.payload = null;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.payload = payload;
    return res;
  });
  return res;
};

describe('profileHandlers', () => {
  let memoryUsers;
  let handlers;

  beforeEach(() => {
    memoryUsers = [
      { id: 1, username: 'u1', points: 120, wins: 3, gamesPlayed: 7, department: 'Mühendislik' },
      { id: 2, username: 'u2', points: 220, wins: 5, gamesPlayed: 10, department: 'İİBF' },
      { id: 3, username: 'u3', points: 50, wins: 1, gamesPlayed: 2, department: 'İİBF' },
    ];

    handlers = createProfileHandlers({
      pool: { query: jest.fn() },
      isDbConnected: jest.fn().mockResolvedValue(false),
      logger: { error: jest.fn(), info: jest.fn() },
      getMemoryUsers: () => memoryUsers,
      setMemoryUsers: (nextUsers) => {
        memoryUsers = nextUsers;
      },
    });
  });

  it('returns leaderboard sorted by points in memory mode', async () => {
    const req = { query: {} };
    const res = createMockRes();

    await handlers.getLeaderboard(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.map((user) => user.username)).toEqual(['u2', 'u1', 'u3']);
  });

  it('filters leaderboard by department in memory mode', async () => {
    const req = { query: { type: 'department', department: 'İİBF' } };
    const res = createMockRes();

    await handlers.getLeaderboard(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toHaveLength(2);
    expect(res.payload[0].username).toBe('u2');
  });

  it('updates user stats in memory mode', async () => {
    const req = {
      params: { id: '1' },
      body: { points: 300, wins: 11, gamesPlayed: 12, department: 'Fen' },
    };
    const res = createMockRes();

    await handlers.updateUserStats(req, res);

    expect(res.statusCode).toBe(200);
    expect(memoryUsers[0].points).toBe(300);
    expect(memoryUsers[0].wins).toBe(11);
    expect(memoryUsers[0].gamesPlayed).toBe(12);
    expect(memoryUsers[0].department).toBe('Fen');
  });

  it('rejects invalid stat payload', async () => {
    const req = {
      params: { id: '1' },
      body: { points: -1, wins: 2, gamesPlayed: 3 },
    };
    const res = createMockRes();

    await handlers.updateUserStats(req, res);

    expect(res.statusCode).toBe(400);
    expect(String(res.payload.error)).toContain('geçerli pozitif');
  });

  it('returns 404 when user not found in memory mode', async () => {
    const req = {
      params: { id: '999' },
      body: { points: 100, wins: 1, gamesPlayed: 5 },
    };
    const res = createMockRes();

    await handlers.updateUserStats(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload.code).toBe('USER_NOT_FOUND');
  });

  it('rejects invalid avatar URL shape', async () => {
    const req = {
      params: { id: '1' },
      body: {
        points: 100,
        wins: 1,
        gamesPlayed: 5,
        avatar_url: 'https://evil.com/hacked.png',
      },
    };
    const res = createMockRes();

    await handlers.updateUserStats(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('INVALID_AVATAR_URL');
  });

  it('accepts a valid DiceBear avatar URL', async () => {
    const req = {
      params: { id: '1' },
      body: {
        points: 100,
        wins: 1,
        gamesPlayed: 5,
        avatar_url: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=MyName',
      },
    };
    const res = createMockRes();

    await handlers.updateUserStats(req, res);

    expect(res.statusCode).toBe(200);
    expect(memoryUsers[0].avatar_url).toBe(
      'https://api.dicebear.com/9.x/pixel-art/svg?seed=MyName'
    );
  });

  it('accepts null avatar_url to clear avatar', async () => {
    memoryUsers[0].avatar_url = 'https://api.dicebear.com/9.x/pixel-art/svg?seed=Old';
    const req = {
      params: { id: '1' },
      body: { points: 100, wins: 1, gamesPlayed: 5, avatar_url: null },
    };
    const res = createMockRes();

    await handlers.updateUserStats(req, res);

    expect(res.statusCode).toBe(200);
    expect(memoryUsers[0].avatar_url).toBeNull();
  });

  it('accepts empty string avatar_url to clear avatar', async () => {
    memoryUsers[0].avatar_url = 'https://api.dicebear.com/9.x/pixel-art/svg?seed=Old';
    const req = {
      params: { id: '1' },
      body: { points: 100, wins: 1, gamesPlayed: 5, avatar_url: '' },
    };
    const res = createMockRes();

    await handlers.updateUserStats(req, res);

    expect(res.statusCode).toBe(200);
    expect(memoryUsers[0].avatar_url).toBeNull();
  });

  it('does not overwrite avatar when avatar_url key is absent from body', async () => {
    memoryUsers[0].avatar_url = 'https://api.dicebear.com/9.x/pixel-art/svg?seed=Existing';
    const req = {
      params: { id: '1' },
      body: { points: 100, wins: 1, gamesPlayed: 5 },
    };
    const res = createMockRes();

    await handlers.updateUserStats(req, res);

    expect(res.statusCode).toBe(200);
    // The avatar_url key should NOT be changed on the returned object
    // (memory mode only patches what was in the body)
    expect(memoryUsers[0].avatar_url).toBe(
      'https://api.dicebear.com/9.x/pixel-art/svg?seed=Existing'
    );
  });

  it('filters out non-user roles from leaderboard in memory mode', async () => {
    memoryUsers.push({
      id: 4,
      username: 'adminGuy',
      points: 9999,
      wins: 99,
      gamesPlayed: 200,
      role: 'admin',
    });
    memoryUsers[0].role = 'user';
    memoryUsers[1].role = 'user';
    memoryUsers[2].role = 'user';

    const req = { query: {} };
    const res = createMockRes();

    await handlers.getLeaderboard(req, res);

    expect(res.payload.some((u) => u.username === 'adminGuy')).toBe(false);
    expect(res.payload.every((u) => (u.role || 'user') === 'user')).toBe(true);
  });

  it('rejects NaN wins payload', async () => {
    const req = {
      params: { id: '1' },
      body: { points: 100, wins: 'abc', gamesPlayed: 3 },
    };
    const res = createMockRes();

    await handlers.updateUserStats(req, res);

    expect(res.statusCode).toBe(400);
  });

  describe('getLeaderboard (DB mode)', () => {
    it('returns DB rows directly', async () => {
      const dbRows = [{ id: 10, username: 'topUser', points: 500, wins: 10, gamesPlayed: 20 }];
      const pool = { query: jest.fn().mockResolvedValue({ rows: dbRows }) };
      const dbHandlers = createProfileHandlers({
        pool,
        isDbConnected: jest.fn().mockResolvedValue(true),
        logger: { error: jest.fn(), info: jest.fn() },
        getMemoryUsers: () => [],
        setMemoryUsers: () => {},
      });

      const req = { query: {} };
      const res = createMockRes();

      await dbHandlers.getLeaderboard(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual(dbRows);
    });

    it('filters by department in DB mode', async () => {
      const dbRows = [{ id: 5, username: 'deptUser', points: 300, wins: 5, gamesPlayed: 10 }];
      const pool = { query: jest.fn().mockResolvedValue({ rows: dbRows }) };
      const dbHandlers = createProfileHandlers({
        pool,
        isDbConnected: jest.fn().mockResolvedValue(true),
        logger: { error: jest.fn(), info: jest.fn() },
        getMemoryUsers: () => [],
        setMemoryUsers: () => {},
      });

      const req = { query: { type: 'department', department: 'Mühendislik' } };
      const res = createMockRes();

      await dbHandlers.getLeaderboard(req, res);

      expect(res.statusCode).toBe(200);
      // Verify department param was passed to query
      const callArgs = pool.query.mock.calls[0];
      expect(callArgs[1]).toContain('Mühendislik');
    });

    it('handles DB error in getLeaderboard gracefully', async () => {
      const pool = { query: jest.fn().mockRejectedValue(new Error('db failure')) };
      const dbHandlers = createProfileHandlers({
        pool,
        isDbConnected: jest.fn().mockResolvedValue(true),
        logger: { error: jest.fn(), info: jest.fn() },
        getMemoryUsers: () => [],
        setMemoryUsers: () => {},
      });

      const req = { query: {} };
      const res = createMockRes();

      await dbHandlers.getLeaderboard(req, res);

      expect(res.statusCode).toBe(500);
    });
  });

  describe('getAchievements (DB mode)', () => {
    it('merges all achievements with user unlocked status', async () => {
      const allAchievements = [
        {
          id: 1,
          title: 'First Win',
          description: 'Win one game',
          condition_type: 'wins',
          condition_value: 1,
          points_reward: 10,
        },
        {
          id: 2,
          title: 'Ten Games',
          description: 'Play 10 games',
          condition_type: 'games_played',
          condition_value: 10,
          points_reward: 20,
        },
      ];
      const userUnlocked = [{ achievement_id: 1, unlocked_at: '2024-01-01' }];
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: allAchievements })
          .mockResolvedValueOnce({ rows: userUnlocked }),
      };
      const dbHandlers = createProfileHandlers({
        pool,
        isDbConnected: jest.fn().mockResolvedValue(true),
        logger: { error: jest.fn(), info: jest.fn() },
        getMemoryUsers: () => [],
        setMemoryUsers: () => {},
      });

      const req = { params: { userId: '1' } };
      const res = createMockRes();

      await dbHandlers.getAchievements(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload[0].unlocked).toBe(true);
      expect(res.payload[0].unlockedAt).toBe('2024-01-01');
      expect(res.payload[1].unlocked).toBe(false);
      expect(res.payload[1].unlockedAt).toBeNull();
    });

    it('handles DB error in getAchievements gracefully', async () => {
      const pool = { query: jest.fn().mockRejectedValue(new Error('db fail')) };
      const dbHandlers = createProfileHandlers({
        pool,
        isDbConnected: jest.fn().mockResolvedValue(true),
        logger: { error: jest.fn(), info: jest.fn() },
        getMemoryUsers: () => [],
        setMemoryUsers: () => {},
      });

      const req = { params: { userId: '1' } };
      const res = createMockRes();

      await dbHandlers.getAchievements(req, res);

      expect(res.statusCode).toBe(500);
    });

    it('returns empty array in memory mode', async () => {
      const req = { params: { userId: '1' } };
      const res = createMockRes();

      await handlers.getAchievements(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual([]);
    });
  });

  describe('updateUserStats (DB mode)', () => {
    it('returns 404 when user not found in DB', async () => {
      const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
      const dbHandlers = createProfileHandlers({
        pool,
        isDbConnected: jest.fn().mockResolvedValue(true),
        logger: { error: jest.fn(), info: jest.fn() },
        getMemoryUsers: () => [],
        setMemoryUsers: () => {},
      });

      const req = { params: { id: '999' }, body: { points: 100, wins: 1, gamesPlayed: 5 } };
      const res = createMockRes();

      await dbHandlers.updateUserStats(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.payload.code).toBe('USER_NOT_FOUND');
    });

    it('returns updated user with cafe_name when user has cafe_id', async () => {
      const updatedUser = {
        id: 1,
        username: 'u1',
        email: 'u1@test.com',
        points: 200,
        wins: 5,
        gamesPlayed: 10,
        department: 'Fen',
        isAdmin: false,
        role: 'user',
        cafe_id: 3,
        table_number: 2,
        avatar_url: null,
      };
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [updatedUser] })
          .mockResolvedValueOnce({ rows: [{ name: 'Test Kafe' }] }),
      };
      const dbHandlers = createProfileHandlers({
        pool,
        isDbConnected: jest.fn().mockResolvedValue(true),
        logger: { error: jest.fn(), info: jest.fn() },
        getMemoryUsers: () => [],
        setMemoryUsers: () => {},
      });

      const req = { params: { id: '1' }, body: { points: 200, wins: 5, gamesPlayed: 10 } };
      const res = createMockRes();

      await dbHandlers.updateUserStats(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload.cafe_name).toBe('Test Kafe');
    });

    it('returns updated user without cafe_name when user has no cafe_id', async () => {
      const updatedUser = {
        id: 2,
        username: 'u2',
        email: 'u2@test.com',
        points: 50,
        wins: 2,
        gamesPlayed: 4,
        department: '',
        isAdmin: false,
        role: 'user',
        cafe_id: null,
        table_number: null,
        avatar_url: null,
      };
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [updatedUser] }),
      };
      const dbHandlers = createProfileHandlers({
        pool,
        isDbConnected: jest.fn().mockResolvedValue(true),
        logger: { error: jest.fn(), info: jest.fn() },
        getMemoryUsers: () => [],
        setMemoryUsers: () => {},
      });

      const req = { params: { id: '2' }, body: { points: 50, wins: 2, gamesPlayed: 4 } };
      const res = createMockRes();

      await dbHandlers.updateUserStats(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload.cafe_name).toBeUndefined();
    });

    it('handles DB error in updateUserStats gracefully', async () => {
      const pool = { query: jest.fn().mockRejectedValue(new Error('db fail')) };
      const dbHandlers = createProfileHandlers({
        pool,
        isDbConnected: jest.fn().mockResolvedValue(true),
        logger: { error: jest.fn(), info: jest.fn() },
        getMemoryUsers: () => [],
        setMemoryUsers: () => {},
      });

      const req = { params: { id: '1' }, body: { points: 100, wins: 1, gamesPlayed: 5 } };
      const res = createMockRes();

      await dbHandlers.updateUserStats(req, res);

      expect(res.statusCode).toBe(500);
    });

    it('includes avatar_url in DB UPDATE when provided in body', async () => {
      const updatedUser = {
        id: 1,
        username: 'u1',
        email: 'u1@test.com',
        points: 100,
        wins: 1,
        gamesPlayed: 5,
        department: '',
        isAdmin: false,
        role: 'user',
        cafe_id: null,
        table_number: null,
        avatar_url: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=Test',
      };
      const pool = { query: jest.fn().mockResolvedValueOnce({ rows: [updatedUser] }) };
      const dbHandlers = createProfileHandlers({
        pool,
        isDbConnected: jest.fn().mockResolvedValue(true),
        logger: { error: jest.fn(), info: jest.fn() },
        getMemoryUsers: () => [],
        setMemoryUsers: () => {},
      });

      const req = {
        params: { id: '1' },
        body: {
          points: 100,
          wins: 1,
          gamesPlayed: 5,
          avatar_url: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=Test',
        },
      };
      const res = createMockRes();

      await dbHandlers.updateUserStats(req, res);

      expect(res.statusCode).toBe(200);
      const sql = pool.query.mock.calls[0][0];
      expect(sql).toContain('avatar_url');
    });
  });
});

describe('partial profile edits', () => {
  let users, pool, handlers;
  const avatar = 'https://api.dicebear.com/9.x/pixel-art/svg?seed=duo';
  const setup = (db = false) => {
    users = [
      {
        id: 1,
        points: 1450,
        wins: 8,
        gamesPlayed: 12,
        department: 'Fen',
        avatar_url: avatar,
        cafe_id: 3,
      },
    ];
    pool = { query: jest.fn() };
    handlers = createProfileHandlers({
      pool,
      isDbConnected: async () => db,
      logger: { error: jest.fn() },
      getMemoryUsers: () => users,
      setMemoryUsers: (next) => {
        users = next;
      },
    });
  };
  beforeEach(() => setup());
  it.each([{ department: 'İşletme' }, { avatar_url: null }, { department: '', avatar_url: '' }])(
    'preserves current statistics and unspecified fields in memory: %j',
    async (body) => {
      const before = { ...users[0] },
        res = createMockRes();
      await handlers.updateUserProfile({ params: { id: '1' }, body }, res);
      expect(res.statusCode).toBe(200);
      expect(users[0]).toEqual({
        ...before,
        ...body,
        ...(Object.hasOwn(body, 'avatar_url') ? { avatar_url: body.avatar_url || null } : {}),
      });
      expect(res.payload).toEqual(users[0]);
    }
  );
  it.each([
    null,
    [],
    {},
    { points: 1 },
    { department: 'Fen', wins: 0 },
    { department: null },
    { department: 'a'.repeat(121) },
  ])('rejects invalid or unrelated fields without a write: %j', async (body) => {
    const before = [...users],
      res = createMockRes();
    await handlers.updateUserProfile({ params: { id: '1' }, body }, res);
    expect(res.statusCode).toBe(400);
    expect(users).toEqual(before);
    expect(pool.query).not.toHaveBeenCalled();
  });
  it('rejects invalid avatars', async () => {
    const res = createMockRes();
    await handlers.updateUserProfile({ params: { id: '1' }, body: { avatar_url: 'invalid' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('INVALID_AVATAR_URL');
    expect(users[0].avatar_url).toBe(avatar);
  });
  it('returns 404 for absent memory users', async () => {
    const res = createMockRes();
    await handlers.updateUserProfile({ params: { id: '404' }, body: { department: '' } }, res);
    expect(res.statusCode).toBe(404);
  });
  it.each([
    { department: 'İşletme' },
    { avatar_url: avatar },
    { department: '', avatar_url: null },
  ])('updates only supplied DB columns and returns current stats and cafe: %j', async (body) => {
    setup(true);
    pool.query
      .mockResolvedValueOnce({ rows: [{ ...users[0], ...body }] })
      .mockResolvedValueOnce({ rows: [{ name: 'Cafe' }] });
    const res = createMockRes();
    await handlers.updateUserProfile({ params: { id: '1' }, body }, res);
    const [sql, params] = pool.query.mock.calls[0];
    const set = sql.split('SET ')[1].split('WHERE ')[0];
    expect(set).not.toMatch(/points|wins|games_played/);
    for (const field of ['department', 'avatar_url'])
      expect(set.includes(field)).toBe(Object.hasOwn(body, field));
    expect(params).toEqual([...Object.values(body), '1']);
    expect(sql).toContain('RETURNING id, username');
    expect(res.payload).toMatchObject({
      points: 1450,
      wins: 8,
      gamesPlayed: 12,
      cafe_name: 'Cafe',
      ...body,
    });
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
  it('returns current DB user when there is no cafe', async () => {
    setup(true);
    pool.query.mockResolvedValue({ rows: [{ ...users[0], cafe_id: null }] });
    const res = createMockRes();
    await handlers.updateUserProfile({ params: { id: '1' }, body: { department: '' } }, res);
    expect(res.statusCode).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
  it('returns 404 for absent DB users', async () => {
    setup(true);
    pool.query.mockResolvedValue({ rows: [] });
    const res = createMockRes();
    await handlers.updateUserProfile({ params: { id: '404' }, body: { department: '' } }, res);
    expect(res.statusCode).toBe(404);
  });
  it('reports DB failure without falling back to a memory write', async () => {
    setup(true);
    pool.query.mockRejectedValue(new Error('Database unavailable'));
    const before = [...users],
      res = createMockRes();
    await handlers.updateUserProfile({ params: { id: '1' }, body: { department: '' } }, res);
    expect(res.statusCode).toBe(500);
    expect(users).toEqual(before);
  });
});
