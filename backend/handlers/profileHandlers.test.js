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
});
