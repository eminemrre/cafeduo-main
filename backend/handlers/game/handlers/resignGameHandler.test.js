/**
 * resignGameHandler unit tests
 *
 * Covers the four denial paths (404 / 403 / 409 not-active / 409 no-opponent)
 * plus the happy path that runs settlement, updates the row, and emits
 * `game_finished` with reason: 'resign'. Both DB and memory branches are
 * exercised through a hand-rolled pg-client mock so the real settlementUtils
 * runs against deterministic SQL pattern matching (mirroring
 * settlementUtils.test.js).
 */

const { createResignGameHandler } = require('./resignGameHandler');
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

const getGameParticipants = (game) =>
  [
    String(game?.host_name || game?.hostName || ''),
    String(game?.guest_name || game?.guestName || ''),
  ].filter(Boolean);

/**
 * pg client mock that:
 *  - returns the seeded games row for `SELECT ... FROM games WHERE id = $1 FOR UPDATE`
 *  - acts like settlementUtils.test.js for user FOR UPDATE + UPDATE statements
 *  - records every call so tests can assert COMMIT/ROLLBACK
 */
const makeDbClient = ({ games = [], users = [] } = {}) => {
  const calls = [];
  const usersByLowerName = new Map(users.map((u) => [String(u.username || '').toLowerCase(), u]));
  return {
    calls,
    games,
    users,
    query: jest.fn(async (sql, params = []) => {
      calls.push({ sql, params });

      // SELECT games row for resign
      if (/FROM\s+games/i.test(sql) && /WHERE\s+id\s*=\s*\$1/i.test(sql)) {
        const row = games.find((g) => String(g.id) === String(params[0]));
        return { rows: row ? [row] : [] };
      }

      // settlementUtils — SELECT users FOR UPDATE
      if (/FROM\s+users/i.test(sql) && /LOWER\(username\)\s*=\s*ANY/i.test(sql)) {
        const needles = (params[0] || []).map((n) => String(n).toLowerCase());
        const rows = needles.map((needle) => usersByLowerName.get(needle)).filter(Boolean);
        return { rows };
      }

      // settlementUtils — UPDATE users (apply mutation locally)
      if (/^\s*UPDATE\s+users/i.test(sql)) {
        const id = params[params.length - 1];
        const row = users.find((u) => u.id === id);
        if (row) {
          if (/points\s*=\s*points\s*\+\s*\$1/i.test(sql)) row.points += params[0];
          if (/wins\s*=\s*wins\s*\+\s*1/i.test(sql)) row.wins = (row.wins || 0) + 1;
          if (/points\s*=\s*GREATEST\(points\s*-\s*\$1/i.test(sql)) {
            row.points = Math.max(0, row.points - params[0]);
          }
          if (/games_played\s*=\s*games_played\s*\+\s*1/i.test(sql)) {
            row.games_played = (row.games_played || 0) + 1;
          }
          if (/wins\s*=\s*wins\s*\+\s*\$1/i.test(sql)) {
            row.wins = (row.wins || 0) + params[0];
          }
        }
        return { rowCount: row ? 1 : 0 };
      }

      // UPDATE games (status, winner, game_state) — capture for assertion
      if (/^\s*UPDATE\s+games/i.test(sql)) {
        const id = params[params.length - 1];
        const row = games.find((g) => String(g.id) === String(id));
        if (row) {
          row.status = params[0] || 'finished';
          row.winner = params[0];
          // Best-effort: we don't reparse here; tests assert against the params directly
        }
        return { rowCount: row ? 1 : 0 };
      }

      return { rows: [] };
    }),
    release: jest.fn(),
  };
};

const makeDeps = (overrides = {}) => {
  const memoryGames = overrides.memoryGames ? [...overrides.memoryGames] : [];
  const memoryUsers = overrides.memoryUsers ? [...overrides.memoryUsers] : [];
  return {
    pool: { connect: jest.fn(async () => overrides.client || makeDbClient()) },
    isDbConnected: jest.fn().mockResolvedValue(Boolean(overrides.dbConnected)),
    logger: { error: jest.fn(), warn: jest.fn() },
    normalizeParticipantName,
    getGameParticipants,
    gameService: overrides.gameService || {},
    getMemoryGames: () => memoryGames,
    setMemoryGames: (next) => {
      memoryGames.length = 0;
      memoryGames.push(...next);
    },
    getMemoryUsers: () => memoryUsers,
    emitRealtimeUpdate: overrides.emitRealtimeUpdate || jest.fn(),
    GAME_STATUS,
    _memoryGamesRef: memoryGames,
    _memoryUsersRef: memoryUsers,
  };
};

describe('resignGameHandler (DB path)', () => {
  it('returns 404 when the game does not exist', async () => {
    const client = makeDbClient({ games: [], users: [] });
    const deps = makeDeps({ dbConnected: true, client });
    const handler = createResignGameHandler(deps);
    const req = { params: { id: '999' }, user: { username: 'u1' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload.error).toMatch(/bulunamadı/i);
    expect(client.calls.some((c) => /ROLLBACK/.test(c.sql))).toBe(true);
  });

  it('returns 403 when actor is not a participant', async () => {
    const client = makeDbClient({
      games: [
        {
          id: 1,
          host_name: 'u1',
          guest_name: 'u2',
          game_type: 'Retro Satranç',
          points: 10,
          status: 'active',
          game_state: {},
        },
      ],
      users: [],
    });
    const deps = makeDeps({ dbConnected: true, client });
    const handler = createResignGameHandler(deps);
    const req = { params: { id: '1' }, user: { username: 'stranger' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(client.calls.some((c) => /ROLLBACK/.test(c.sql))).toBe(true);
  });

  it('returns 409 when game is not in ACTIVE status', async () => {
    const client = makeDbClient({
      games: [
        {
          id: 1,
          host_name: 'u1',
          guest_name: 'u2',
          game_type: 'Retro Satranç',
          points: 10,
          status: 'waiting',
          game_state: {},
        },
      ],
      users: [],
    });
    const deps = makeDeps({ dbConnected: true, client });
    const handler = createResignGameHandler(deps);
    const req = { params: { id: '1' }, user: { username: 'u1' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('invalid_status_transition');
  });

  it('returns 409 when game has no opponent', async () => {
    const client = makeDbClient({
      games: [
        {
          id: 1,
          host_name: 'u1',
          guest_name: '', // no opponent
          game_type: 'Retro Satranç',
          points: 10,
          status: 'active',
          game_state: {},
        },
      ],
      users: [],
    });
    const deps = makeDeps({ dbConnected: true, client });
    const handler = createResignGameHandler(deps);
    const req = { params: { id: '1' }, user: { username: 'u1' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.error).toMatch(/Rakip bulunamadığı/i);
  });

  it('declares opponent as winner, transfers stake, and emits game_finished', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Retro Satranç',
      points: 30,
      status: 'active',
      winner: null,
      game_state: {},
    };
    const users = [
      { id: 1, username: 'Alice', points: 200, wins: 0, games_played: 0 },
      { id: 2, username: 'Bob', points: 100, wins: 0, games_played: 0 },
    ];
    const client = makeDbClient({ games: [game], users });
    const emitRealtimeUpdate = jest.fn();
    const deps = makeDeps({ dbConnected: true, client, emitRealtimeUpdate });
    const handler = createResignGameHandler(deps);

    // Alice resigns → Bob wins
    const req = { params: { id: '1' }, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(
      expect.objectContaining({ success: true, winner: 'Bob', reason: 'resign' })
    );

    // Settlement: Bob +30 from Alice
    expect(users[0].points).toBe(170); // Alice 200 - 30
    expect(users[1].points).toBe(130); // Bob 100 + 30
    expect(users[1].wins).toBe(1);

    // Emit with reason
    expect(emitRealtimeUpdate).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        type: 'game_finished',
        gameId: '1',
        status: 'finished',
        winner: 'Bob',
        reason: 'resign',
      })
    );

    // Status set on the SQL UPDATE
    const updateCall = client.calls.find((c) => /UPDATE\s+games/i.test(c.sql));
    expect(updateCall.params[0]).toBe('Bob'); // winner
    const stateJson = JSON.parse(updateCall.params[1]);
    expect(stateJson.resolvedWinner).toBe('Bob');
    expect(stateJson.resignedBy).toBe('Alice');
    expect(stateJson.settlementApplied).toBe(true);
    expect(stateJson.stakeTransferred).toBe(30);

    // Commit happened
    expect(client.calls.some((c) => /COMMIT/.test(c.sql))).toBe(true);
  });

  it('marks chess state as resigned and resolves winner when game is Retro Satranç', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Retro Satranç',
      points: 0,
      status: 'active',
      winner: null,
      game_state: {
        chess: {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          clock: {
            baseMs: 180000,
            incrementMs: 2000,
            whiteMs: 120000,
            blackMs: 90000,
            lastTickAt: '2026-05-11T10:00:00Z',
          },
          isGameOver: false,
        },
      },
    };
    const users = [
      { id: 1, username: 'Alice', points: 50, wins: 0, games_played: 0 },
      { id: 2, username: 'Bob', points: 50, wins: 0, games_played: 0 },
    ];
    const client = makeDbClient({ games: [game], users });
    const deps = makeDeps({ dbConnected: true, client });
    const handler = createResignGameHandler(deps);
    const req = { params: { id: '1' }, user: { username: 'Bob' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const updateCall = client.calls.find((c) => /UPDATE\s+games/i.test(c.sql));
    const stateJson = JSON.parse(updateCall.params[1]);
    expect(stateJson.chess).toBeDefined();
    expect(stateJson.chess.winner).toBe('Alice');
    expect(stateJson.chess.result).toBe('resign');
    expect(stateJson.chess.isGameOver).toBe(true);
    expect(stateJson.chess.clock.lastTickAt).toBeNull();
  });

  it('returns 500 and rolls back on settlement failure', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Retro Satranç',
      points: 30,
      status: 'active',
      winner: null,
      game_state: {},
    };
    // Break the client mid-flight: throw on UPDATE games
    const client = makeDbClient({
      games: [game],
      users: [
        { id: 1, username: 'Alice', points: 200, wins: 0, games_played: 0 },
        { id: 2, username: 'Bob', points: 100, wins: 0, games_played: 0 },
      ],
    });
    const originalQuery = client.query;
    client.query = jest.fn(async (sql, params) => {
      if (/UPDATE\s+games/i.test(sql)) throw new Error('boom');
      return originalQuery(sql, params);
    });

    const deps = makeDeps({ dbConnected: true, client });
    const handler = createResignGameHandler(deps);
    const req = { params: { id: '1' }, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(deps.logger.error).toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });
});

describe('resignGameHandler (memory path)', () => {
  it('returns 404 when memory game not found', async () => {
    const deps = makeDeps();
    const handler = createResignGameHandler(deps);
    const req = { params: { id: '404' }, user: { username: 'u1' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when actor is not in the game', async () => {
    const deps = makeDeps({
      memoryGames: [
        {
          id: 1,
          hostName: 'u1',
          guestName: 'u2',
          gameType: 'Retro Satranç',
          points: 10,
          status: 'active',
        },
      ],
    });
    const handler = createResignGameHandler(deps);
    const req = { params: { id: '1' }, user: { username: 'stranger' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
  });

  it('returns 409 when memory game is not ACTIVE', async () => {
    const deps = makeDeps({
      memoryGames: [
        {
          id: 1,
          hostName: 'u1',
          guestName: 'u2',
          gameType: 'Retro Satranç',
          points: 10,
          status: 'waiting',
        },
      ],
    });
    const handler = createResignGameHandler(deps);
    const req = { params: { id: '1' }, user: { username: 'u1' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('invalid_status_transition');
  });

  it('marks finished, transfers stake to opponent, and emits game_finished (memory)', async () => {
    const memoryGames = [
      {
        id: 1,
        hostName: 'Alice',
        guestName: 'Bob',
        gameType: 'Retro Satranç',
        points: 30,
        status: 'active',
        gameState: {},
      },
    ];
    const memoryUsers = [
      { id: 1, username: 'Alice', points: 200, wins: 0, gamesPlayed: 0 },
      { id: 2, username: 'Bob', points: 100, wins: 0, gamesPlayed: 0 },
    ];
    const emitRealtimeUpdate = jest.fn();
    const deps = makeDeps({ memoryGames, memoryUsers, emitRealtimeUpdate });
    const handler = createResignGameHandler(deps);
    const req = { params: { id: '1' }, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(
      expect.objectContaining({ success: true, winner: 'Bob', reason: 'resign' })
    );

    const game = deps._memoryGamesRef[0];
    expect(game.status).toBe('finished');
    expect(game.winner).toBe('Bob');
    expect(game.gameState.resolvedWinner).toBe('Bob');
    expect(game.gameState.resignedBy).toBe('Alice');
    expect(game.gameState.settlementApplied).toBe(true);
    expect(game.gameState.stakeTransferred).toBe(30);

    // Stake transferred
    expect(deps._memoryUsersRef[0].points).toBe(170); // Alice
    expect(deps._memoryUsersRef[1].points).toBe(130); // Bob

    expect(emitRealtimeUpdate).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ type: 'game_finished', winner: 'Bob', reason: 'resign' })
    );
  });
});

describe('resignGameHandler – protocol v2 boundary', () => {
  it('refuses to settle a competitive game through the legacy resign endpoint (DB)', async () => {
    const client = makeDbClient({
      games: [
        {
          id: 70,
          host_name: 'Alice',
          guest_name: 'Bob',
          game_type: 'Bilgi Yarışı',
          points: 10,
          status: 'active',
          winner: null,
          game_state: { engine: { version: 2, phase: 'open' } },
        },
      ],
    });
    const deps = makeDeps({ dbConnected: true, client });
    const handler = createResignGameHandler(deps);
    const res = createMockRes();

    await handler(
      { params: { id: '70' }, user: { username: 'Alice', role: 'user' }, body: {} },
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('USE_ENGINE_ACTION');
  });

  it('refuses to settle a competitive game through the legacy resign endpoint (memory)', async () => {
    const game = {
      id: 71,
      hostName: 'Alice',
      guestName: 'Bob',
      gameType: 'Bilgi Yarışı',
      points: 10,
      status: 'active',
      gameState: { engine: { version: 2, phase: 'open' } },
    };
    const deps = makeDeps({ memoryGames: [game] });
    const handler = createResignGameHandler(deps);
    const res = createMockRes();

    await handler(
      { params: { id: '71' }, user: { username: 'Alice', role: 'user' }, body: {} },
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('USE_ENGINE_ACTION');
    expect(game.status).toBe('active');
  });
});
