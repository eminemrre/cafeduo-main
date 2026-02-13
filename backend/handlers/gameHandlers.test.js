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
  let memoryUsers;
  let handlers;

  beforeEach(() => {
    memoryGames = [];
    memoryUsers = [
      { id: 1, username: 'u1', cafe_id: 1, table_number: 5, points: 200, wins: 0, gamesPlayed: 0 },
      { id: 2, username: 'u2', cafe_id: 1, table_number: 7, points: 200, wins: 0, gamesPlayed: 0 },
      { id: 3, username: 'u3', cafe_id: 2, table_number: 9, points: 50, wins: 0, gamesPlayed: 0 },
    ];

    handlers = createGameHandlers({
      pool: { query: jest.fn(), connect: jest.fn() },
      isDbConnected: jest.fn().mockResolvedValue(false),
      logger: { error: jest.fn() },
      supportedGameTypes: new Set([
        'Refleks Avı',
        'Ritim Kopyala',
        'Çift Tek Sprint',
        'Tank Düellosu',
        'Retro Satranç',
        'Bilgi Yarışı',
      ]),
      normalizeGameType: (value) => {
        const raw = String(value || '').trim();
        return [
          'Refleks Avı',
          'Ritim Kopyala',
          'Çift Tek Sprint',
          'Tank Düellosu',
          'Retro Satranç',
          'Bilgi Yarışı',
        ].includes(raw)
          ? raw
          : null;
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
      getMemoryUsers: () => memoryUsers,
    });
  });

  it('returns empty game list for non-check-in user', async () => {
    const req = { user: { username: 'u1', role: 'user', isAdmin: false, table_number: null } };
    const res = createMockRes();

    await handlers.getGames(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual([]);
  });

  it('shows same-cafe waiting games across tables when scope=all is requested', async () => {
    memoryGames = [
      {
        id: 101,
        hostName: 'u1',
        gameType: 'Refleks Avı',
        points: 30,
        table: 'MASA05',
        status: 'waiting',
      },
      {
        id: 102,
        hostName: 'u3',
        gameType: 'Ritim Kopyala',
        points: 40,
        table: 'MASA09',
        status: 'waiting',
      },
    ];

    const req = {
      user: { username: 'u2', role: 'user', isAdmin: false, table_number: '7', cafe_id: 1 },
      query: { scope: 'all' },
    };
    const res = createMockRes();

    await handlers.getGames(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toHaveLength(1);
    expect(res.payload[0]).toMatchObject({
      id: 101,
      hostName: 'u1',
      table: 'MASA05',
    });
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

  it('applies chess tempo config while creating retro chess game', async () => {
    const req = {
      user: { username: 'u1', role: 'user', isAdmin: false, table_number: '5', cafe_id: 1, points: 500 },
      body: {
        gameType: 'Retro Satranç',
        points: 90,
        chessClock: { baseSeconds: 300, incrementSeconds: 3, label: '5+3 Rapid' },
      },
    };
    const res = createMockRes();

    await handlers.createGame(req, res);

    expect(res.statusCode).toBe(201);
    expect(memoryGames).toHaveLength(1);
    expect(memoryGames[0].gameType).toBe('Retro Satranç');
    expect(memoryGames[0].gameState?.chess?.clock?.baseMs).toBe(300000);
    expect(memoryGames[0].gameState?.chess?.clock?.incrementMs).toBe(3000);
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

  it('allows same guest to rejoin an already active game', async () => {
    memoryGames = [
      {
        id: 71,
        hostName: 'u1',
        guestName: 'u2',
        gameType: 'Refleks Avı',
        points: 20,
        table: 'MASA05',
        status: 'active',
      },
    ];

    const joinReq = {
      params: { id: '71' },
      user: { username: 'u2', role: 'user', isAdmin: false, table_number: '7', cafe_id: 1 },
    };
    const res = createMockRes();

    await handlers.joinGame(joinReq, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ success: true });
    expect(res.payload.game).toMatchObject({
      id: 71,
      status: 'active',
      guestName: 'u2',
    });
  });

  it('rejects third player join attempt when game is active', async () => {
    memoryGames = [
      {
        id: 72,
        hostName: 'u1',
        guestName: 'u2',
        gameType: 'Refleks Avı',
        points: 20,
        table: 'MASA05',
        status: 'active',
      },
    ];

    const joinReq = {
      params: { id: '72' },
      user: { username: 'u3', role: 'user', isAdmin: false, table_number: '9', cafe_id: 2 },
    };
    const res = createMockRes();

    await handlers.joinGame(joinReq, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toMatchObject({ error: 'Oyun dolu.' });
  });

  it('rejects join when player has insufficient points for stake', async () => {
    memoryGames = [
      {
        id: 75,
        hostName: 'u1',
        gameType: 'Refleks Avı',
        points: 120,
        table: 'MASA05',
        status: 'waiting',
      },
    ];

    const joinReq = {
      params: { id: '75' },
      user: { username: 'u3', role: 'user', isAdmin: false, table_number: '9', cafe_id: 2, points: 50 },
    };
    const res = createMockRes();

    await handlers.joinGame(joinReq, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload?.error).toContain('120');
  });

  it('rejects join when status transition is invalid', async () => {
    memoryGames = [
      {
        id: 77,
        hostName: 'u1',
        gameType: 'Refleks Avı',
        points: 20,
        table: 'MASA05',
        status: 'finishing',
      },
    ];

    const joinReq = {
      params: { id: '77' },
      user: { username: 'u2', role: 'user', isAdmin: false, table_number: '7', cafe_id: 1 },
    };
    const res = createMockRes();
    await handlers.joinGame(joinReq, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload?.code).toBe('invalid_status_transition');
  });

  it('validates classic chess turn order and updates chess state', async () => {
    memoryGames = [
      {
        id: 12,
        hostName: 'u1',
        guestName: 'u2',
        gameType: 'Retro Satranç',
        points: 90,
        table: 'MASA05',
        status: 'active',
        gameState: {},
      },
    ];

    const hostMoveReq = {
      params: { id: '12' },
      user: { username: 'u1', role: 'user', isAdmin: false },
      body: { chessMove: { from: 'e2', to: 'e4' } },
    };
    const hostMoveRes = createMockRes();
    await handlers.makeMove(hostMoveReq, hostMoveRes);
    expect(hostMoveRes.statusCode).toBe(200);
    expect(hostMoveRes.payload?.gameState?.chess?.fen).toContain(' b ');
    expect(memoryGames[0].player1Move).toBe('e4');

    const duplicateTurnReq = {
      params: { id: '12' },
      user: { username: 'u1', role: 'user', isAdmin: false },
      body: { chessMove: { from: 'd2', to: 'd4' } },
    };
    const duplicateTurnRes = createMockRes();
    await handlers.makeMove(duplicateTurnReq, duplicateTurnRes);
    expect(duplicateTurnRes.statusCode).toBe(409);

    const guestMoveReq = {
      params: { id: '12' },
      user: { username: 'u2', role: 'user', isAdmin: false },
      body: { chessMove: { from: 'e7', to: 'e5' } },
    };
    const guestMoveRes = createMockRes();
    await handlers.makeMove(guestMoveReq, guestMoveRes);
    expect(guestMoveRes.statusCode).toBe(200);
    expect(guestMoveRes.payload?.gameState?.chess?.fen).toContain(' w ');
    expect(memoryGames[0].player2Move).toBe('e5');
  });

  it('finishes chess immediately when active side clock is exhausted during state fetch', async () => {
    const timedOutTick = new Date(Date.now() - 4000).toISOString();
    memoryGames = [
      {
        id: 19,
        hostName: 'u1',
        guestName: 'u2',
        gameType: 'Retro Satranç',
        points: 90,
        table: 'MASA05',
        status: 'active',
        gameState: {
          chess: {
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            moveHistory: [],
            clock: {
              baseMs: 1000,
              incrementMs: 0,
              label: '1+0',
              whiteMs: 1000,
              blackMs: 1000,
              lastTickAt: timedOutTick,
            },
          },
        },
      },
    ];

    const req = {
      params: { id: '19' },
      user: { username: 'u1', role: 'user', isAdmin: false },
    };
    const res = createMockRes();

    await handlers.getGameState(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload?.status).toBe('finished');
    expect(res.payload?.winner).toBe('u2');
    expect(memoryGames[0].status).toBe('finished');
    expect(memoryGames[0].gameState?.chess?.result).toBe('timeout');
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

  it('includes chess move count and tempo in user history response', async () => {
    memoryGames = [
      {
        id: 14,
        hostName: 'u1',
        guestName: 'u2',
        gameType: 'Retro Satranç',
        points: 90,
        table: 'MASA05',
        status: 'finished',
        winner: 'u1',
        createdAt: '2026-02-10T10:00:00.000Z',
        gameState: {
          chess: {
            moveHistory: [{ from: 'e2', to: 'e4', san: 'e4', ts: '2026-02-10T10:01:00.000Z' }],
            clock: { baseMs: 180000, incrementMs: 2000 },
          },
        },
      },
    ];

    const req = {
      params: { username: 'u1' },
      user: { username: 'u1', role: 'user', isAdmin: false },
    };
    const res = createMockRes();

    await handlers.getUserGameHistory(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toHaveLength(1);
    expect(res.payload[0]).toMatchObject({
      id: 14,
      moveCount: 1,
      chessTempo: '3+2',
    });
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

  it('allows forfeit finish only when actor picks opponent as winner', async () => {
    memoryGames = [
      {
        id: 33,
        hostName: 'u1',
        guestName: 'u2',
        gameType: 'Refleks Avı',
        points: 30,
        table: 'MASA01',
        status: 'active',
        gameState: {},
      },
    ];

    const finishReq = {
      params: { id: '33' },
      user: { username: 'u1', role: 'user', isAdmin: false },
      body: { winner: 'u2' },
    };
    const finishRes = createMockRes();
    await handlers.finishGame(finishReq, finishRes);

    expect(finishRes.statusCode).toBe(200);
    expect(memoryGames[0].status).toBe('finished');
    expect(memoryGames[0].winner).toBe('u2');
  });

  it('rejects manual finish when actor tries to set self as winner', async () => {
    memoryGames = [
      {
        id: 34,
        hostName: 'u1',
        guestName: 'u2',
        gameType: 'Refleks Avı',
        points: 30,
        table: 'MASA01',
        status: 'active',
        gameState: {},
      },
    ];

    const finishReq = {
      params: { id: '34' },
      user: { username: 'u1', role: 'user', isAdmin: false },
      body: { winner: 'u1' },
    };
    const finishRes = createMockRes();
    await handlers.finishGame(finishReq, finishRes);

    expect(finishRes.statusCode).toBe(403);
    expect(finishRes.payload?.error).toContain('sadece rakibini');
    expect(memoryGames[0].status).toBe('active');
  });

  it('applies point transfer on finish (winner +stake, loser -stake)', async () => {
    memoryGames = [
      {
        id: 32,
        hostName: 'u1',
        guestName: 'u2',
        gameType: 'Tank Düellosu',
        points: 40,
        table: 'MASA01',
        status: 'active',
        gameState: { resolvedWinner: 'u1' },
      },
    ];

    const finishReq = {
      params: { id: '32' },
      user: { username: 'u1', role: 'user', isAdmin: false },
      body: {},
    };
    const finishRes = createMockRes();
    await handlers.finishGame(finishReq, finishRes);

    expect(finishRes.statusCode).toBe(200);
    const winner = memoryUsers.find((u) => u.username === 'u1');
    const loser = memoryUsers.find((u) => u.username === 'u2');
    expect(winner.points).toBe(240);
    expect(loser.points).toBe(160);
    expect(winner.wins).toBe(1);
    expect(winner.gamesPlayed).toBe(1);
    expect(loser.gamesPlayed).toBe(1);
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
