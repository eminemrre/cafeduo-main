const { createGameHandlers } = require('./gameHandlers');

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

const normalizeTableCode = (rawValue) => {
  const raw = String(rawValue || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw.startsWith('MASA')) return raw;
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric > 0) {
    return `MASA${String(numeric).padStart(2, '0')}`;
  }
  return null;
};

describe('gameHandlers (memory mode)', () => {
  let memoryGames;
  let handlers;

  beforeEach(() => {
    memoryGames = [];

    handlers = createGameHandlers({
      pool: { query: jest.fn(), connect: jest.fn() },
      isDbConnected: jest.fn().mockResolvedValue(false),
      logger: { error: jest.fn() },
      supportedGameTypes: new Set(['Refleks Avı', 'Ritim Kopyala', 'Çift Tek Sprint']),
      normalizeGameType: (value) => {
        const raw = String(value || '').trim();
        return ['Refleks Avı', 'Ritim Kopyala', 'Çift Tek Sprint'].includes(raw) ? raw : null;
      },
      normalizeTableCode,
      getGameParticipants: (game) => [
        String(game.host_name || game.hostName || ''),
        String(game.guest_name || game.guestName || ''),
      ].filter(Boolean),
      normalizeParticipantName: (name, game) => {
        const normalized = String(name || '').trim().toLowerCase();
        const host = String(game.host_name || game.hostName || '').trim().toLowerCase();
        const guest = String(game.guest_name || game.guestName || '').trim().toLowerCase();
        if (normalized && normalized === host) return String(game.host_name || game.hostName);
        if (normalized && normalized === guest) return String(game.guest_name || game.guestName);
        return null;
      },
      sanitizeScoreSubmission: (payload) => ({ score: Number(payload.score || 0), username: payload.username }),
      pickWinnerFromResults: (results, participants) => {
        const [a, b] = participants;
        const scoreA = Number(results?.[a]?.score || 0);
        const scoreB = Number(results?.[b]?.score || 0);
        if (!a || !b) return null;
        if (!results?.[a] || !results?.[b]) return null;
        return scoreA >= scoreB ? a : b;
      },
      getMemoryGames: () => memoryGames,
      setMemoryGames: (nextGames) => {
        memoryGames = nextGames;
      },
    });
  });

  it('returns empty game list for non-check-in user', async () => {
    const req = { user: { username: 'u1', role: 'user', isAdmin: false, table_number: null } };
    const res = createMockRes();

    await handlers.getGames(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual([]);
  });

  it('creates game for checked-in user', async () => {
    const req = {
      user: { username: 'u1', role: 'user', isAdmin: false, table_number: '5', cafe_id: 1, points: 120 },
      body: { gameType: 'Refleks Avı', points: 50 },
    };
    const res = createMockRes();

    await handlers.createGame(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(memoryGames).toHaveLength(1);
    expect(memoryGames[0].table).toBe('MASA05');
  });

  it('allows checked-in users to join waiting games', async () => {
    memoryGames = [
      {
        id: 1,
        hostName: 'u1',
        gameType: 'Refleks Avı',
        points: 20,
        table: 'MASA05',
        status: 'waiting',
      },
    ];

    const joinReq = {
      params: { id: '1' },
      user: { username: 'u2', role: 'user', isAdmin: false, table_number: '7', cafe_id: 1 },
    };
    const okRes = createMockRes();
    await handlers.joinGame(joinReq, okRes);
    expect(okRes.statusCode).toBe(200);
    expect(memoryGames[0].status).toBe('active');
    expect(memoryGames[0].guestName).toBe('u2');
  });

  it('accepts score submissions and resolves winner', async () => {
    memoryGames = [
      {
        id: 2,
        hostName: 'u1',
        guestName: 'u2',
        gameType: 'Ritim Kopyala',
        points: 20,
        table: 'MASA01',
        status: 'active',
        gameState: {},
      },
    ];

    const moveReq1 = {
      params: { id: '2' },
      user: { username: 'u1', role: 'user', isAdmin: false },
      body: { scoreSubmission: { score: 10 } },
    };
    const moveRes1 = createMockRes();
    await handlers.makeMove(moveReq1, moveRes1);
    expect(moveRes1.statusCode).toBe(200);
    expect(moveRes1.payload.resolvedWinner).toBeNull();

    const moveReq2 = {
      params: { id: '2' },
      user: { username: 'u2', role: 'user', isAdmin: false },
      body: { scoreSubmission: { score: 5 } },
    };
    const moveRes2 = createMockRes();
    await handlers.makeMove(moveReq2, moveRes2);
    expect(moveRes2.statusCode).toBe(200);
    expect(moveRes2.payload.resolvedWinner).toBe('u1');
  });

  it('finishes and deletes game with proper auth', async () => {
    memoryGames = [
      {
        id: 3,
        hostName: 'u1',
        guestName: 'u2',
        gameType: 'Çift Tek Sprint',
        points: 20,
        table: 'MASA01',
        status: 'active',
        gameState: { resolvedWinner: 'u2' },
      },
    ];

    const finishReq = {
      params: { id: '3' },
      user: { username: 'u1', role: 'user', isAdmin: false },
      body: {},
    };
    const finishRes = createMockRes();
    await handlers.finishGame(finishReq, finishRes);
    expect(finishRes.statusCode).toBe(200);
    expect(memoryGames[0].status).toBe('finished');

    const deleteReq = {
      params: { id: '3' },
      user: { username: 'u1', role: 'user', isAdmin: false },
    };
    const deleteRes = createMockRes();
    await handlers.deleteGame(deleteReq, deleteRes);
    expect(deleteRes.statusCode).toBe(200);
    expect(memoryGames).toHaveLength(0);
  });

  it('returns recent finished game history for actor', async () => {
    memoryGames = [
      {
        id: 10,
        hostName: 'u1',
        guestName: 'u2',
        winner: 'u1',
        gameType: 'Refleks Avı',
        points: 25,
        table: 'MASA03',
        status: 'finished',
        createdAt: '2026-02-08T10:00:00Z',
      },
      {
        id: 11,
        hostName: 'u3',
        guestName: 'u1',
        winner: 'u3',
        gameType: 'Çift Tek Sprint',
        points: 35,
        table: 'MASA07',
        status: 'finished',
        createdAt: '2026-02-08T11:00:00Z',
      },
    ];

    const req = {
      params: { username: 'u1' },
      user: { username: 'u1', role: 'user', isAdmin: false },
    };
    const res = createMockRes();
    await handlers.getUserGameHistory(req, res);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.payload)).toBe(true);
    expect(res.payload).toHaveLength(2);
    expect(res.payload[0]).toMatchObject({
      id: 11,
      opponentName: 'u3',
      didWin: false,
    });
    expect(res.payload[1]).toMatchObject({
      id: 10,
      opponentName: 'u2',
      didWin: true,
    });
  });
});
