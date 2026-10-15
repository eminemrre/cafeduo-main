/**
 * createGameHandler unit tests
 *
 * Covers the validation gates (hostName/gameType, check-in, stake, ceiling)
 * plus both DB and memory creation paths. Cache invalidation and lobby
 * emission are asserted as side effects so regressions here don't silently
 * break the realtime lobby.
 */

const { createCreateGameHandler } = require('./createGameHandler');

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

const normalizeGameType = (value) => {
  const raw = String(value || '').trim();
  return ['Nişancı Düellosu', 'Retro Satranç', 'Bilgi Yarışı'].includes(raw) ? raw : null;
};

const normalizeTableCode = (rawValue) => {
  const raw = String(rawValue || '')
    .trim()
    .toUpperCase();
  if (!raw) return null;
  if (raw.startsWith('MASA')) return raw;
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric > 0) {
    return `MASA${String(numeric).padStart(2, '0')}`;
  }
  return null;
};

/** Minimal DB client that records each query and lets you script returns. */
const makeDbClient = (overrides = {}) => {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql) => {
      calls.push({ sql });
      if (overrides.onQuery) return overrides.onQuery(sql);
      return { rows: [] };
    }),
    release: jest.fn(),
  };
};

const makeDeps = (overrides = {}) => {
  const memoryGames = overrides.memoryGames ? [...overrides.memoryGames] : [];
  return {
    pool: {
      connect: jest.fn(async () => overrides.client || makeDbClient()),
    },
    isDbConnected: jest.fn().mockResolvedValue(Boolean(overrides.dbConnected)),
    logger: { error: jest.fn(), warn: jest.fn() },
    normalizeGameType,
    normalizeTableCode,
    gameService: overrides.gameService || {
      findParticipantPendingOrActiveGameForUpdate: jest.fn().mockResolvedValue(null),
      insertWaitingGame: jest.fn().mockResolvedValue({
        id: 100,
        hostName: 'u1',
        gameType: 'Nişancı Düellosu',
        points: 50,
        table: 'MASA05',
        status: 'waiting',
        guestName: null,
      }),
    },
    lobbyCacheService: overrides.lobbyCacheService || {
      onGameCreated: jest.fn().mockResolvedValue(undefined),
    },
    getMemoryGames: () => memoryGames,
    setMemoryGames: (next) => {
      memoryGames.length = 0;
      memoryGames.push(...next);
    },
    emitLobbyUpdate: overrides.emitLobbyUpdate || jest.fn(),
    _memoryGamesRef: memoryGames,
  };
};

describe('createGameHandler validation gates', () => {
  it('returns 400 when hostName is missing', async () => {
    const deps = makeDeps();
    const handler = createCreateGameHandler(deps);
    const req = { user: { username: '   ' }, body: { gameType: 'Nişancı Düellosu' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/hostName/);
  });

  it('returns 400 when gameType is unsupported', async () => {
    const deps = makeDeps();
    const handler = createCreateGameHandler(deps);
    const req = { user: { username: 'u1' }, body: { gameType: 'Pinball' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/gameType/);
  });

  it('returns 403 when non-admin has no check-in (no cafe_id or no table)', async () => {
    const deps = makeDeps();
    const handler = createCreateGameHandler(deps);
    const req = {
      user: { username: 'u1', cafe_id: null, table_number: null },
      body: { gameType: 'Nişancı Düellosu' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.payload.error).toMatch(/check-in/);
  });

  it('returns 400 when non-admin stakes more than their balance', async () => {
    const deps = makeDeps();
    const handler = createCreateGameHandler(deps);
    const req = {
      user: { username: 'u1', cafe_id: 1, table_number: '5', points: 30 },
      body: { gameType: 'Nişancı Düellosu', points: 200 },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/bakiyenden/);
  });

  it('returns 400 when stake exceeds the 150 cap even for admin', async () => {
    // PR #36 — stake cap tightened from 5000 → 150 to keep matches reasonable.
    const deps = makeDeps();
    const handler = createCreateGameHandler(deps);
    const req = {
      user: { username: 'admin', role: 'admin', isAdmin: true, points: 100000 },
      body: { gameType: 'Nişancı Düellosu', points: 200 },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/en fazla 150/i);
  });

  it('allows admin without check-in to create game (bypasses 403)', async () => {
    const deps = makeDeps();
    const handler = createCreateGameHandler(deps);
    const req = {
      user: { username: 'admin', role: 'admin', isAdmin: true, points: 100 },
      body: { gameType: 'Nişancı Düellosu', points: 0 },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(deps.emitLobbyUpdate).toHaveBeenCalled();
  });
});

describe('createGameHandler (DB path)', () => {
  it('returns 409 when participant already has a pending or active game', async () => {
    const client = makeDbClient();
    const gameService = {
      findParticipantPendingOrActiveGameForUpdate: jest
        .fn()
        .mockResolvedValue({ id: 50, status: 'waiting' }),
      insertWaitingGame: jest.fn(),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createCreateGameHandler(deps);
    const req = {
      user: { username: 'u1', cafe_id: 1, table_number: '5', points: 200 },
      body: { gameType: 'Nişancı Düellosu', points: 50 },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.error).toMatch(/mevcut oyun/i);
    expect(res.payload.game).toEqual({ id: 50, status: 'waiting' });
    expect(gameService.insertWaitingGame).not.toHaveBeenCalled();
    // ROLLBACK must be issued
    expect(client.calls.some((c) => /ROLLBACK/.test(c.sql))).toBe(true);
  });

  it('creates a game, invalidates lobby cache, and emits lobby update on success', async () => {
    const client = makeDbClient();
    const created = {
      id: 777,
      hostName: 'u1',
      gameType: 'Nişancı Düellosu',
      points: 50,
      table: 'MASA05',
      status: 'waiting',
      guestName: null,
    };
    const gameService = {
      findParticipantPendingOrActiveGameForUpdate: jest.fn().mockResolvedValue(null),
      insertWaitingGame: jest.fn().mockResolvedValue(created),
    };
    const onGameCreated = jest.fn().mockResolvedValue(undefined);
    const emitLobbyUpdate = jest.fn();
    const deps = makeDeps({
      dbConnected: true,
      client,
      gameService,
      lobbyCacheService: { onGameCreated },
      emitLobbyUpdate,
    });
    const handler = createCreateGameHandler(deps);
    const req = {
      user: { username: 'u1', cafe_id: 1, table_number: '5', points: 200 },
      body: { gameType: 'Nişancı Düellosu', points: 50 },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.payload).toEqual(created);
    expect(gameService.insertWaitingGame).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        hostName: 'u1',
        gameType: 'Nişancı Düellosu',
        points: 50,
        table: 'MASA05',
      })
    );
    expect(onGameCreated).toHaveBeenCalledWith({ tableCode: 'MASA05', cafeId: 1 });
    expect(emitLobbyUpdate).toHaveBeenCalledWith({
      action: 'game_created',
      gameId: 777,
      tableCode: 'MASA05',
      status: 'waiting',
    });
    expect(client.calls.some((c) => /BEGIN/.test(c.sql))).toBe(true);
    expect(client.calls.some((c) => /COMMIT/.test(c.sql))).toBe(true);
    expect(client.release).toHaveBeenCalled();
  });

  it('attaches chess initial state when gameType is Retro Satranç', async () => {
    const client = makeDbClient();
    const gameService = {
      findParticipantPendingOrActiveGameForUpdate: jest.fn().mockResolvedValue(null),
      insertWaitingGame: jest.fn().mockResolvedValue({
        id: 1,
        hostName: 'u1',
        gameType: 'Retro Satranç',
        points: 30,
        table: 'MASA05',
        status: 'waiting',
        guestName: null,
      }),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createCreateGameHandler(deps);
    const req = {
      user: { username: 'u1', cafe_id: 1, table_number: '5', points: 100 },
      body: { gameType: 'Retro Satranç', points: 30 },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(gameService.insertWaitingGame).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        gameState: expect.objectContaining({
          chess: expect.objectContaining({
            fen: expect.any(String),
            clock: expect.any(Object),
          }),
        }),
      })
    );
  });

  it('returns a safe correlated 500, rolls back, and never publishes database details', async () => {
    const client = makeDbClient();
    const failure = Object.assign(new Error('private SQL failure'), {
      code: '23503',
      detail: 'private row content',
      hint: 'private hint',
      column: 'private_column',
      table: 'private_table',
      routine: 'private_routine',
      position: '42',
    });
    const gameService = {
      findParticipantPendingOrActiveGameForUpdate: jest.fn().mockResolvedValue(null),
      insertWaitingGame: jest.fn().mockRejectedValue(failure),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createCreateGameHandler(deps);
    const req = {
      user: { username: 'u1', cafe_id: 1, table_number: '5', points: 200 },
      body: { gameType: 'Nişancı Düellosu', points: 50 },
    };
    const res = createMockRes();

    res.req = { requestId: 'game-error-test' };
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({
      error: 'Oyun kurulamadı.',
      code: 'INTERNAL_ERROR',
      message: 'Oyun kurulamadı.',
      details: null,
      requestId: 'game-error-test',
      status: 500,
    });
    expect(JSON.stringify(res.payload)).not.toMatch(/private|23503|debug|routine|column/);
    expect(JSON.stringify(deps.logger.error.mock.calls)).not.toMatch(
      /private|debug|routine|column/
    );
    expect(deps.emitLobbyUpdate).not.toHaveBeenCalled();
    expect(deps.lobbyCacheService.onGameCreated).not.toHaveBeenCalled();
    expect(client.calls.some((c) => /ROLLBACK/.test(c.sql))).toBe(true);
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'game-error-test' })
    );
    expect(client.release).toHaveBeenCalled();
  });

  it('swallows lobby cache invalidation errors without failing the request', async () => {
    const client = makeDbClient();
    const gameService = {
      findParticipantPendingOrActiveGameForUpdate: jest.fn().mockResolvedValue(null),
      insertWaitingGame: jest.fn().mockResolvedValue({
        id: 1,
        hostName: 'u1',
        gameType: 'Nişancı Düellosu',
        points: 0,
        table: 'MASA05',
        status: 'waiting',
        guestName: null,
      }),
    };
    const onGameCreated = jest.fn().mockRejectedValue(new Error('redis down'));
    const deps = makeDeps({
      dbConnected: true,
      client,
      gameService,
      lobbyCacheService: { onGameCreated },
    });
    const handler = createCreateGameHandler(deps);
    const req = {
      user: { username: 'u1', cafe_id: 1, table_number: '5', points: 200 },
      body: { gameType: 'Nişancı Düellosu', points: 0 },
    };
    const res = createMockRes();

    await handler(req, res);
    // microtask flush so the fire-and-forget catch() handler runs
    await Promise.resolve();
    await Promise.resolve();

    expect(res.statusCode).toBe(201);
    expect(deps.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Cache invalidation failed/)
    );
  });
});

describe('createGameHandler (memory path)', () => {
  it('returns 409 when host already has a waiting or active memory game', async () => {
    const deps = makeDeps({
      memoryGames: [
        {
          id: 1,
          hostName: 'u1',
          gameType: 'Nişancı Düellosu',
          points: 10,
          table: 'MASA05',
          status: 'waiting',
        },
      ],
    });
    const handler = createCreateGameHandler(deps);
    const req = {
      user: { username: 'u1', cafe_id: 1, table_number: '5', points: 200 },
      body: { gameType: 'Nişancı Düellosu', points: 50 },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.game).toMatchObject({ id: 1, hostName: 'u1' });
  });

  it('prepends a new memory game and emits lobby update on success', async () => {
    const deps = makeDeps();
    const handler = createCreateGameHandler(deps);
    const req = {
      user: { username: 'u1', cafe_id: 1, table_number: '5', points: 200 },
      body: { gameType: 'Nişancı Düellosu', points: 50 },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(deps._memoryGamesRef).toHaveLength(1);
    expect(deps._memoryGamesRef[0]).toMatchObject({
      hostName: 'u1',
      gameType: 'Nişancı Düellosu',
      points: 50,
      table: 'MASA05',
      status: 'waiting',
      guestName: null,
    });
    expect(deps.emitLobbyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'game_created',
        tableCode: 'MASA05',
        status: 'waiting',
      })
    );
  });

  it('falls back to MASA00 when neither user nor body provides a table code', async () => {
    const deps = makeDeps();
    const handler = createCreateGameHandler(deps);
    const req = {
      // admin bypasses check-in requirement so we can hit the table fallback
      user: { username: 'admin', role: 'admin', isAdmin: true, points: 100 },
      body: { gameType: 'Nişancı Düellosu', points: 0 },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(deps._memoryGamesRef[0].table).toBe('MASA00');
  });
});
