/**
 * joinGameHandler unit tests
 *
 * Covers validation (guestName, check-in, self-join, stake), idempotency for
 * a guest re-hitting an already-active game, the "game full" fork, player
 * conflict detection, chess clock activation, and lobby emit/cache flow.
 */

const { createJoinGameHandler } = require('./joinGameHandler');

// Join tests below cover the handler, not the rollout gate; keep protocol v2 open.
process.env.GAME_ENGINE_V2_ENABLED = 'true';
const { GAME_STATUS } = require('../../../utils/gameStateMachine');

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

const normalizeParticipantName = (name, game) => {
  const normalized = String(name || '')
    .trim()
    .toLowerCase();
  const host = String(game?.host_name || game?.hostName || '')
    .trim()
    .toLowerCase();
  const guest = String(game?.guest_name || game?.guestName || '')
    .trim()
    .toLowerCase();
  if (normalized && normalized === host) return String(game?.host_name || game?.hostName);
  if (normalized && normalized === guest) return String(game?.guest_name || game?.guestName);
  return null;
};

const makeDbClient = () => {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql) => {
      calls.push({ sql });
      return { rows: [] };
    }),
    release: jest.fn(),
  };
};

const makeDeps = (overrides = {}) => {
  const memoryGames = overrides.memoryGames ? [...overrides.memoryGames] : [];
  return {
    pool: { connect: jest.fn(async () => overrides.client || makeDbClient()) },
    isDbConnected: jest.fn().mockResolvedValue(Boolean(overrides.dbConnected)),
    logger: { error: jest.fn(), warn: jest.fn() },
    normalizeTableCode,
    normalizeParticipantName,
    gameService: overrides.gameService || {
      findGameByIdForUpdate: jest.fn().mockResolvedValue(null),
      activateGameWithGuest: jest.fn(),
      findActivePlayerConflict: jest.fn().mockResolvedValue(null),
    },
    lobbyCacheService: overrides.lobbyCacheService || {
      onGameJoined: jest.fn().mockResolvedValue(undefined),
    },
    getMemoryGames: () => memoryGames,
    emitRealtimeUpdate: overrides.emitRealtimeUpdate || jest.fn(),
    emitLobbyUpdate: overrides.emitLobbyUpdate || jest.fn(),
    GAME_STATUS,
    _memoryGamesRef: memoryGames,
  };
};

describe('joinGameHandler validation gates', () => {
  it('returns 400 when guestName is missing', async () => {
    const deps = makeDeps();
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: {}, body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/guestName/);
  });

  it('returns 403 when non-admin guest has no check-in', async () => {
    const deps = makeDeps();
    const handler = createJoinGameHandler(deps);
    const req = {
      params: { id: '1' },
      user: { username: 'u2' },
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.payload.error).toMatch(/check-in/);
  });
});

describe('joinGameHandler (DB path)', () => {
  const checkedInUser = (overrides = {}) => ({
    username: 'u2',
    cafe_id: 1,
    table_number: '7',
    points: 200,
    ...overrides,
  });

  it('returns 404 when the game does not exist', async () => {
    const client = makeDbClient();
    const gameService = {
      findGameByIdForUpdate: jest.fn().mockResolvedValue(null),
      activateGameWithGuest: jest.fn(),
      findActivePlayerConflict: jest.fn(),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '404' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload.error).toMatch(/bulunamadı/i);
    expect(client.calls.some((c) => /ROLLBACK/.test(c.sql))).toBe(true);
  });

  it('returns 400 when user tries to join their own game', async () => {
    const client = makeDbClient();
    const gameService = {
      findGameByIdForUpdate: jest.fn().mockResolvedValue({
        id: 1,
        host_name: 'u2',
        guest_name: null,
        game_type: 'Nişancı Düellosu',
        points: 0,
        status: 'waiting',
        game_state: {},
      }),
      activateGameWithGuest: jest.fn(),
      findActivePlayerConflict: jest.fn(),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/kendi oyununa/i);
    expect(gameService.activateGameWithGuest).not.toHaveBeenCalled();
  });

  it('returns 409 with transition error when game is already finished', async () => {
    const client = makeDbClient();
    const gameService = {
      findGameByIdForUpdate: jest.fn().mockResolvedValue({
        id: 1,
        host_name: 'u1',
        guest_name: 'u3',
        game_type: 'Nişancı Düellosu',
        points: 0,
        status: 'finished',
        game_state: {},
      }),
      activateGameWithGuest: jest.fn(),
      findActivePlayerConflict: jest.fn(),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('invalid_status_transition');
    expect(gameService.activateGameWithGuest).not.toHaveBeenCalled();
  });

  it('returns 400 when non-admin guest has insufficient points for the stake', async () => {
    const client = makeDbClient();
    const gameService = {
      findGameByIdForUpdate: jest.fn().mockResolvedValue({
        id: 1,
        host_name: 'u1',
        guest_name: null,
        game_type: 'Nişancı Düellosu',
        points: 500,
        status: 'waiting',
        game_state: {},
      }),
      activateGameWithGuest: jest.fn(),
      findActivePlayerConflict: jest.fn(),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createJoinGameHandler(deps);
    const req = {
      params: { id: '1' },
      user: checkedInUser({ points: 50 }),
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/500 puan gerekli/);
  });

  it('idempotently returns the active game when same guest re-hits join', async () => {
    const client = makeDbClient();
    const activeGame = {
      id: 1,
      host_name: 'u1',
      guest_name: 'u2',
      game_type: 'Nişancı Düellosu',
      points: 0,
      status: 'active',
      game_state: { foo: 'bar' },
      table_code: 'MASA05',
      created_at: '2026-05-11T10:00:00Z',
    };
    const gameService = {
      findGameByIdForUpdate: jest.fn().mockResolvedValue(activeGame),
      activateGameWithGuest: jest.fn(),
      findActivePlayerConflict: jest.fn(),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(res.payload.game.guestName).toBe('u2');
    expect(client.calls.some((c) => /COMMIT/.test(c.sql))).toBe(true);
    expect(gameService.activateGameWithGuest).not.toHaveBeenCalled();
  });

  it('returns 409 "Oyun dolu" when game is active but with a different guest', async () => {
    const client = makeDbClient();
    const gameService = {
      findGameByIdForUpdate: jest.fn().mockResolvedValue({
        id: 1,
        host_name: 'u1',
        guest_name: 'someone_else',
        game_type: 'Nişancı Düellosu',
        points: 0,
        status: 'active',
        game_state: {},
      }),
      activateGameWithGuest: jest.fn(),
      findActivePlayerConflict: jest.fn(),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.error).toMatch(/dolu/i);
  });

  it('returns 409 when guest is already in another active game', async () => {
    const client = makeDbClient();
    const gameService = {
      findGameByIdForUpdate: jest.fn().mockResolvedValue({
        id: 1,
        host_name: 'u1',
        guest_name: null,
        game_type: 'Nişancı Düellosu',
        points: 0,
        status: 'waiting',
        game_state: {},
      }),
      activateGameWithGuest: jest.fn(),
      findActivePlayerConflict: jest.fn().mockResolvedValue({ id: 99 }),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.error).toMatch(/aktif bir oyunda/);
    expect(gameService.activateGameWithGuest).not.toHaveBeenCalled();
  });

  it('activates the game, invalidates cache, and emits join + lobby updates', async () => {
    const client = makeDbClient();
    const joinedGame = {
      id: 1,
      hostName: 'u1',
      guestName: 'u2',
      gameType: 'Nişancı Düellosu',
      points: 30,
      table: 'MASA05',
      status: 'active',
      gameState: {},
    };
    const gameService = {
      findGameByIdForUpdate: jest.fn().mockResolvedValue({
        id: 1,
        host_name: 'u1',
        guest_name: null,
        game_type: 'Nişancı Düellosu',
        points: 30,
        status: 'waiting',
        game_state: {},
      }),
      activateGameWithGuest: jest.fn().mockResolvedValue(joinedGame),
      findActivePlayerConflict: jest.fn().mockResolvedValue(null),
    };
    const onGameJoined = jest.fn().mockResolvedValue(undefined);
    const emitRealtimeUpdate = jest.fn();
    const emitLobbyUpdate = jest.fn();
    const deps = makeDeps({
      dbConnected: true,
      client,
      gameService,
      lobbyCacheService: { onGameJoined },
      emitRealtimeUpdate,
      emitLobbyUpdate,
    });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(gameService.activateGameWithGuest).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ gameId: '1', guestName: 'u2' })
    );
    expect(onGameJoined).toHaveBeenCalledWith({ tableCode: 'MASA05' });
    expect(emitRealtimeUpdate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ type: 'game_joined', status: 'active', guestName: 'u2' })
    );
    expect(emitLobbyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'game_joined', tableCode: 'MASA05' })
    );
  });

  it('arms the chess clock on join for a Retro Satranç game', async () => {
    const client = makeDbClient();
    const gameService = {
      findGameByIdForUpdate: jest.fn().mockResolvedValue({
        id: 1,
        host_name: 'u1',
        guest_name: null,
        game_type: 'Retro Satranç',
        points: 0,
        status: 'waiting',
        game_state: {
          chess: {
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            clock: { baseMs: 180000, incrementMs: 2000, whiteMs: 180000, blackMs: 180000 },
          },
        },
      }),
      activateGameWithGuest: jest.fn().mockImplementation(async (_c, payload) => ({
        id: 1,
        hostName: 'u1',
        guestName: 'u2',
        gameType: 'Retro Satranç',
        table: 'MASA05',
        status: 'active',
        gameState: payload.gameState,
      })),
      findActivePlayerConflict: jest.fn().mockResolvedValue(null),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    // The activated game state's chess clock should have lastTickAt set
    const activated = gameService.activateGameWithGuest.mock.calls[0][1];
    expect(activated.gameState.chess.clock.lastTickAt).toBeTruthy();
  });

  it('returns 500 and rolls back on unexpected DB error', async () => {
    const client = makeDbClient();
    const gameService = {
      findGameByIdForUpdate: jest.fn().mockRejectedValue(new Error('connection lost')),
      activateGameWithGuest: jest.fn(),
      findActivePlayerConflict: jest.fn(),
    };
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(client.calls.some((c) => /ROLLBACK/.test(c.sql))).toBe(true);
    expect(deps.logger.error).toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });
});

describe('joinGameHandler (memory path)', () => {
  const checkedInUser = (overrides = {}) => ({
    username: 'u2',
    cafe_id: 1,
    table_number: '7',
    points: 200,
    ...overrides,
  });

  it('returns 404 when memory game is missing', async () => {
    const deps = makeDeps();
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '999' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('rejects self-join in memory mode', async () => {
    const deps = makeDeps({
      memoryGames: [
        {
          id: 1,
          hostName: 'u2',
          gameType: 'Nişancı Düellosu',
          points: 0,
          table: 'MASA05',
          status: 'waiting',
        },
      ],
    });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/kendi oyununa/i);
  });

  it('flips waiting → active, sets guestName, and emits events', async () => {
    const emitRealtimeUpdate = jest.fn();
    const emitLobbyUpdate = jest.fn();
    const deps = makeDeps({
      memoryGames: [
        {
          id: 1,
          hostName: 'u1',
          guestName: null,
          gameType: 'Nişancı Düellosu',
          points: 0,
          table: 'MASA05',
          status: 'waiting',
        },
      ],
      emitRealtimeUpdate,
      emitLobbyUpdate,
    });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(deps._memoryGamesRef[0].status).toBe('active');
    expect(deps._memoryGamesRef[0].guestName).toBe('u2');
    expect(emitRealtimeUpdate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ type: 'game_joined', status: 'active' })
    );
    expect(emitLobbyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'game_joined', tableCode: 'MASA05' })
    );
  });

  it('returns same active game idempotently for the same guest', async () => {
    const deps = makeDeps({
      memoryGames: [
        {
          id: 1,
          hostName: 'u1',
          guestName: 'u2',
          gameType: 'Nişancı Düellosu',
          points: 0,
          table: 'MASA05',
          status: 'active',
        },
      ],
    });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(res.payload.game.guestName).toBe('u2');
  });

  it('returns 409 "Oyun dolu" when active game already has another guest', async () => {
    const deps = makeDeps({
      memoryGames: [
        {
          id: 1,
          hostName: 'u1',
          guestName: 'someone_else',
          gameType: 'Nişancı Düellosu',
          points: 0,
          table: 'MASA05',
          status: 'active',
        },
      ],
    });
    const handler = createJoinGameHandler(deps);
    const req = { params: { id: '1' }, user: checkedInUser(), body: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.error).toMatch(/dolu/i);
  });

  it('rejects join when guest cannot afford stake (memory)', async () => {
    const deps = makeDeps({
      memoryGames: [
        {
          id: 1,
          hostName: 'u1',
          guestName: null,
          gameType: 'Nişancı Düellosu',
          points: 999,
          table: 'MASA05',
          status: 'waiting',
        },
      ],
    });
    const handler = createJoinGameHandler(deps);
    const req = {
      params: { id: '1' },
      user: checkedInUser({ points: 10 }),
      body: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/puan gerekli/);
  });
});

describe('joinGameHandler – protocol v2 rollout gate', () => {
  const original = process.env.GAME_ENGINE_V2_ENABLED;
  afterEach(() => {
    process.env.GAME_ENGINE_V2_ENABLED = original;
  });

  it('refuses to join a quiz/aim game while the flag is off', async () => {
    delete process.env.GAME_ENGINE_V2_ENABLED;
    const game = {
      id: 7,
      host_name: 'Alice',
      guest_name: null,
      game_type: 'Bilgi Yarışı',
      points: 10,
      table_code: 'MASA05',
      status: 'waiting',
      game_state: {},
      created_at: new Date().toISOString(),
    };
    const deps = {
      pool: {
        connect: jest.fn(async () => ({
          query: jest.fn(async (sql) =>
            /FROM\s+games/i.test(sql) ? { rows: [game] } : { rows: [] }
          ),
          release: jest.fn(),
        })),
      },
      isDbConnected: jest.fn(async () => true),
      logger: { error: jest.fn(), warn: jest.fn() },
      normalizeTableCode,
      normalizeParticipantName,
      gameService: { findGameByIdForUpdate: jest.fn(async () => game) },
      lobbyCacheService: {},
      getMemoryGames: () => [],
      emitRealtimeUpdate: jest.fn(),
      emitLobbyUpdate: jest.fn(),
      GAME_STATUS,
    };
    const handler = createJoinGameHandler(deps);
    const res = createMockRes();
    await handler(
      {
        params: { id: '7' },
        user: { username: 'Bob', cafe_id: 1, table_number: '5', points: 100 },
        body: {},
      },
      res
    );
    expect(res.statusCode).toBe(503);
    expect(res.payload.code).toBe('GAME_ENGINE_MAINTENANCE');
  });
});
