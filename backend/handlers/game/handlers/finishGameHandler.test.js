/**
 * finishGameHandler unit tests
 *
 * Covers:
 *  DB path:
 *   - 404 (game not found)
 *   - 403 (non-participant, non-admin)
 *   - 409 server_result_pending (no winner derived, non-admin sends winner)
 *   - 409 server_result_pending (no winner, no chess draw, no manual)
 *   - 409 invalid status transition (waiting → finished not allowed via this path)
 *   - 400 invalid winner (admin sends unknown name, no derived winner)
 *   - happy path win: settlement + emit
 *   - already-finished idempotent (alreadyFinished + no settlement re-run)
 *   - already-finished late settlement (settlementApplied absent)
 *   - already-finished conflicting winner → 409
 *   - chess draw path (isChessDraw=true, no winner, draw emit)
 *   - 500 + rollback on error
 *  Memory path:
 *   - 404
 *   - 403
 *   - 409 server_result_pending
 *   - happy path win: settlement + emit
 *   - chess draw (memory)
 *   - already-finished late settlement (memory)
 */

const { createFinishGameHandler } = require('./finishGameHandler');
const { GAME_STATUS } = require('../../../utils/gameStateMachine');

// ---------------------------------------------------------------------------
// Shared helpers (identical pattern to resignGameHandler.test.js)
// ---------------------------------------------------------------------------

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
 * Hand-rolled pg client mock — mirrors resignGameHandler.test.js pattern but
 * uses gameService.findGameByIdForUpdate instead of a direct SELECT pattern,
 * so the game lookup is handled by the gameService mock.
 */
const makeDbClient = ({ users = [] } = {}) => {
  const calls = [];
  const usersByLowerName = new Map(users.map((u) => [String(u.username || '').toLowerCase(), u]));
  return {
    calls,
    users,
    query: jest.fn(async (sql, params = []) => {
      calls.push({ sql, params });

      // Settlement — SELECT users FOR UPDATE
      if (/FROM\s+users/i.test(sql) && /LOWER\(username\)\s*=\s*ANY/i.test(sql)) {
        const needles = (params[0] || []).map((n) => String(n).toLowerCase());
        const rows = needles.map((n) => usersByLowerName.get(n)).filter(Boolean);
        return { rows };
      }

      // Settlement — UPDATE users (win path)
      if (/^\s*UPDATE\s+users/i.test(sql)) {
        const id = params[params.length - 1];
        const row = users.find((u) => u.id === id);
        if (row) {
          if (/points\s*=\s*points\s*\+\s*\$1/i.test(sql)) row.points += params[0];
          if (/wins\s*=\s*wins\s*\+\s*1/i.test(sql)) row.wins = (row.wins || 0) + 1;
          if (/GREATEST\(points\s*-\s*\$1/i.test(sql))
            row.points = Math.max(0, row.points - params[0]);
          if (/games_played\s*=\s*games_played\s*\+\s*1/i.test(sql))
            row.games_played = (row.games_played || 0) + 1;
          if (/wins\s*=\s*wins\s*\+\s*\$1/i.test(sql)) row.wins = (row.wins || 0) + params[0];
        }
        return { rowCount: row ? 1 : 0 };
      }

      return { rows: [], rowCount: 0 };
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
    // Default: no winner derivable from results unless overridden
    pickWinnerFromResults: overrides.pickWinnerFromResults || jest.fn(() => null),
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

// Convenience: make a gameService that returns the given game row from findGameByIdForUpdate
const makeGameService = (game, extraMethods = {}) => ({
  findGameByIdForUpdate: jest.fn(async () => game || null),
  finishGameInDb: jest.fn(async () => {}),
  updateGameStateInDb: jest.fn(async () => {}),
  ...extraMethods,
});

// ---------------------------------------------------------------------------
// DB path tests
// ---------------------------------------------------------------------------

describe('finishGameHandler (DB path)', () => {
  it('returns 404 when game is not found', async () => {
    const client = makeDbClient();
    const deps = makeDeps({
      dbConnected: true,
      client,
      gameService: makeGameService(null),
    });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '999' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.payload.error).toMatch(/bulunamadı/i);
    expect(client.calls.some((c) => /ROLLBACK/.test(c.sql))).toBe(true);
  });

  it('rejects a client-supplied winner with 410 before touching the database', async () => {
    const client = makeDbClient();
    const deps = makeDeps({
      dbConnected: true,
      client,
      gameService: makeGameService(null),
    });
    const handler = createFinishGameHandler(deps);
    const req = {
      params: { id: '1' },
      body: { winner: 'Alice' },
      user: { username: 'Alice' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.payload.code).toBe('LEGACY_PROTOCOL_DISABLED');
    expect(client.query).not.toHaveBeenCalled();
  });

  it('returns 403 when actor is not a participant and not admin', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Nişancı Düellosu',
      points: 10,
      status: 'active',
      winner: null,
      game_state: { resolvedWinner: 'Alice', results: {} },
    };
    const client = makeDbClient();
    const deps = makeDeps({
      dbConnected: true,
      client,
      gameService: makeGameService(game),
    });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Stranger' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(client.calls.some((c) => /ROLLBACK/.test(c.sql))).toBe(true);
  });

  it('returns 409 server_result_pending when no winner and no chess draw', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Nişancı Düellosu',
      points: 10,
      status: 'active',
      winner: null,
      game_state: {},
    };
    const client = makeDbClient();
    const deps = makeDeps({
      dbConnected: true,
      client,
      gameService: makeGameService(game),
    });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('server_result_pending');
  });

  it('rejects an admin-supplied winner the same way (no manual result via finish)', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Nişancı Düellosu',
      points: 10,
      status: 'active',
      winner: null,
      game_state: {},
    };
    const client = makeDbClient();
    const deps = makeDeps({
      dbConnected: true,
      client,
      gameService: makeGameService(game),
    });
    const handler = createFinishGameHandler(deps);
    const req = {
      params: { id: '1' },
      body: { winner: 'UnknownPlayer' },
      user: { username: 'admin', role: 'admin' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.payload.code).toBe('LEGACY_PROTOCOL_DISABLED');
  });

  it('happy path win: transfers stake, updates status, emits game_finished', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Nişancı Düellosu',
      points: 30,
      status: 'active',
      winner: null,
      game_state: { resolvedWinner: 'Alice', results: {} },
    };
    const users = [
      { id: 1, username: 'Alice', points: 200, wins: 0, games_played: 0 },
      { id: 2, username: 'Bob', points: 100, wins: 0, games_played: 0 },
    ];
    const client = makeDbClient({ users });
    const emitRealtimeUpdate = jest.fn();
    const deps = makeDeps({
      dbConnected: true,
      client,
      gameService: makeGameService(game),
      emitRealtimeUpdate,
    });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(
      expect.objectContaining({ success: true, winner: 'Alice', draw: false })
    );

    // Settlement: Bob loses 30 to Alice
    expect(users[0].points).toBe(230); // Alice +30
    expect(users[1].points).toBe(70); // Bob -30
    expect(users[0].wins).toBe(1);

    expect(emitRealtimeUpdate).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ type: 'game_finished', winner: 'Alice', draw: false })
    );
    expect(client.calls.some((c) => /COMMIT/.test(c.sql))).toBe(true);
  });

  it('stake transfer is capped at loser current points (min rule)', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Nişancı Düellosu',
      points: 100, // stake bigger than Bob's balance
      status: 'active',
      winner: null,
      game_state: { resolvedWinner: 'Alice' },
    };
    const users = [
      { id: 1, username: 'Alice', points: 200, wins: 0, games_played: 0 },
      { id: 2, username: 'Bob', points: 40, wins: 0, games_played: 0 }, // only 40 available
    ];
    const client = makeDbClient({ users });
    const deps = makeDeps({ dbConnected: true, client, gameService: makeGameService(game) });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // Transfer is min(100, 40) = 40
    expect(users[0].points).toBe(240);
    expect(users[1].points).toBe(0);
  });

  it('chess draw path: no stake transfer, emits draw:true, winner:null', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Retro Satranç',
      points: 20,
      status: 'active',
      winner: null,
      game_state: {
        chess: { isGameOver: true, fen: 'startpos' },
      },
    };
    const users = [
      { id: 1, username: 'Alice', points: 100, wins: 0, games_played: 0 },
      { id: 2, username: 'Bob', points: 100, wins: 0, games_played: 0 },
    ];
    const client = makeDbClient({ users });
    const emitRealtimeUpdate = jest.fn();
    const deps = makeDeps({
      dbConnected: true,
      client,
      gameService: makeGameService(game),
      emitRealtimeUpdate,
    });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.winner).toBeNull();
    expect(res.payload.draw).toBe(true);
    // No points transferred for draw
    expect(users[0].points).toBe(100);
    expect(users[1].points).toBe(100);

    expect(emitRealtimeUpdate).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ type: 'game_finished', winner: null, draw: true })
    );
  });

  it('already-finished + settlementApplied: returns alreadyFinished=true without re-settling', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Nişancı Düellosu',
      points: 30,
      status: 'finished',
      winner: 'Alice',
      game_state: { resolvedWinner: 'Alice', settlementApplied: true, stakeTransferred: 30 },
    };
    const users = [
      { id: 1, username: 'Alice', points: 230, wins: 1, games_played: 1 },
      { id: 2, username: 'Bob', points: 70, wins: 0, games_played: 1 },
    ];
    const client = makeDbClient({ users });
    const deps = makeDeps({ dbConnected: true, client, gameService: makeGameService(game) });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.alreadyFinished).toBe(true);
    expect(res.payload.winner).toBe('Alice');
    // No additional point mutations
    expect(users[0].points).toBe(230);
    expect(users[1].points).toBe(70);
    expect(client.calls.some((c) => /ROLLBACK/.test(c.sql))).toBe(true);
  });

  it('already-finished + no settlementApplied: applies late settlement and emits', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Nişancı Düellosu',
      points: 30,
      status: 'finished',
      winner: 'Alice',
      game_state: { resolvedWinner: 'Alice' }, // settlementApplied absent
    };
    const users = [
      { id: 1, username: 'Alice', points: 200, wins: 0, games_played: 0 },
      { id: 2, username: 'Bob', points: 100, wins: 0, games_played: 0 },
    ];
    const client = makeDbClient({ users });
    const emitRealtimeUpdate = jest.fn();
    const deps = makeDeps({
      dbConnected: true,
      client,
      gameService: makeGameService(game),
      emitRealtimeUpdate,
    });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.alreadyFinished).toBe(true);
    expect(res.payload.settlementApplied).toBe(true);
    // Settlement ran
    expect(users[0].points).toBe(230);
    expect(users[1].points).toBe(70);
    expect(emitRealtimeUpdate).toHaveBeenCalled();
  });

  it('already-finished with conflicting winner returns 409', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Nişancı Düellosu',
      points: 30,
      status: 'finished',
      winner: 'Bob', // stored winner is Bob
      game_state: { resolvedWinner: 'Alice' }, // but request resolves to Alice
    };
    const client = makeDbClient();
    const deps = makeDeps({ dbConnected: true, client, gameService: makeGameService(game) });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.error).toMatch(/farklı/i);
  });

  it('returns 500 and rolls back on unexpected error', async () => {
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Nişancı Düellosu',
      points: 30,
      status: 'active',
      winner: null,
      game_state: { resolvedWinner: 'Alice' },
    };
    const users = [
      { id: 1, username: 'Alice', points: 200, wins: 0, games_played: 0 },
      { id: 2, username: 'Bob', points: 100, wins: 0, games_played: 0 },
    ];
    const client = makeDbClient({ users });
    // Make finishGameInDb throw
    const gameService = makeGameService(game, {
      finishGameInDb: jest.fn(async () => {
        throw new Error('db boom');
      }),
    });
    const deps = makeDeps({ dbConnected: true, client, gameService });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(deps.logger.error).toHaveBeenCalled();
    expect(client.calls.some((c) => /ROLLBACK/.test(c.sql))).toBe(true);
    expect(client.release).toHaveBeenCalled();
  });

  it('invalid status transition (waiting→finished without using finished path) returns 409', async () => {
    // waiting status: assertGameStatusTransition allows waiting→finished, so
    // we test finishing→finished via invalid status transitions using a status
    // that actually blocks, e.g. an unknown status
    const game = {
      id: 1,
      host_name: 'Alice',
      guest_name: 'Bob',
      game_type: 'Nişancı Düellosu',
      points: 10,
      status: 'invalid_state', // unknown status → assertGameStatusTransition fails
      winner: null,
      game_state: { resolvedWinner: 'Alice' },
    };
    const client = makeDbClient();
    const deps = makeDeps({ dbConnected: true, client, gameService: makeGameService(game) });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(client.calls.some((c) => /ROLLBACK/.test(c.sql))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Memory path tests
// ---------------------------------------------------------------------------

describe('finishGameHandler (memory path)', () => {
  it('returns 404 when game not found in memory', async () => {
    const deps = makeDeps();
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '99' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when actor is not a participant', async () => {
    const deps = makeDeps({
      memoryGames: [
        {
          id: 1,
          hostName: 'Alice',
          guestName: 'Bob',
          gameType: 'Nişancı Düellosu',
          points: 10,
          status: 'active',
          gameState: { resolvedWinner: 'Alice' },
        },
      ],
    });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Stranger' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
  });

  it('returns 409 server_result_pending when no winner and no chess draw', async () => {
    const deps = makeDeps({
      memoryGames: [
        {
          id: 1,
          hostName: 'Alice',
          guestName: 'Bob',
          gameType: 'Nişancı Düellosu',
          points: 10,
          status: 'active',
          gameState: {},
        },
      ],
    });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('server_result_pending');
  });

  it('happy path win: transfers stake, updates game in memory, emits game_finished', async () => {
    const memoryGames = [
      {
        id: 1,
        hostName: 'Alice',
        guestName: 'Bob',
        gameType: 'Nişancı Düellosu',
        points: 30,
        status: 'active',
        winner: null,
        gameState: { resolvedWinner: 'Alice' },
      },
    ];
    const memoryUsers = [
      { id: 1, username: 'Alice', points: 200, wins: 0, gamesPlayed: 0 },
      { id: 2, username: 'Bob', points: 100, wins: 0, gamesPlayed: 0 },
    ];
    const emitRealtimeUpdate = jest.fn();
    const deps = makeDeps({ memoryGames, memoryUsers, emitRealtimeUpdate });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(
      expect.objectContaining({ success: true, winner: 'Alice', draw: false })
    );

    const game = deps._memoryGamesRef[0];
    expect(game.status).toBe('finished');
    expect(game.winner).toBe('Alice');
    expect(game.gameState.settlementApplied).toBe(true);
    expect(game.gameState.stakeTransferred).toBe(30);

    expect(deps._memoryUsersRef[0].points).toBe(230); // Alice +30
    expect(deps._memoryUsersRef[1].points).toBe(70); // Bob -30
    expect(deps._memoryUsersRef[0].wins).toBe(1);

    expect(emitRealtimeUpdate).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ type: 'game_finished', winner: 'Alice' })
    );
  });

  it('chess draw (memory): no stake transfer, draw:true, winner:null', async () => {
    const memoryGames = [
      {
        id: 1,
        hostName: 'Alice',
        guestName: 'Bob',
        gameType: 'Retro Satranç',
        points: 20,
        status: 'active',
        winner: null,
        gameState: { chess: { isGameOver: true } },
      },
    ];
    const memoryUsers = [
      { id: 1, username: 'Alice', points: 100, wins: 0, gamesPlayed: 0 },
      { id: 2, username: 'Bob', points: 100, wins: 0, gamesPlayed: 0 },
    ];
    const emitRealtimeUpdate = jest.fn();
    const deps = makeDeps({ memoryGames, memoryUsers, emitRealtimeUpdate });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.winner).toBeNull();
    expect(res.payload.draw).toBe(true);
    expect(deps._memoryUsersRef[0].points).toBe(100);
    expect(deps._memoryUsersRef[1].points).toBe(100);
  });

  it('already-finished (memory) + no settlementApplied: runs late settlement and emits', async () => {
    const memoryGames = [
      {
        id: 1,
        hostName: 'Alice',
        guestName: 'Bob',
        gameType: 'Nişancı Düellosu',
        points: 30,
        status: 'finished',
        winner: 'Alice',
        gameState: { resolvedWinner: 'Alice' }, // no settlementApplied
      },
    ];
    const memoryUsers = [
      { id: 1, username: 'Alice', points: 200, wins: 0, gamesPlayed: 0 },
      { id: 2, username: 'Bob', points: 100, wins: 0, gamesPlayed: 0 },
    ];
    const emitRealtimeUpdate = jest.fn();
    const deps = makeDeps({ memoryGames, memoryUsers, emitRealtimeUpdate });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.alreadyFinished).toBe(true);
    // Late settlement ran
    expect(deps._memoryUsersRef[0].points).toBe(230);
    expect(deps._memoryUsersRef[1].points).toBe(70);
    expect(emitRealtimeUpdate).toHaveBeenCalled();
  });

  it('already-finished (memory) + conflicting winner returns 409', async () => {
    const memoryGames = [
      {
        id: 1,
        hostName: 'Alice',
        guestName: 'Bob',
        gameType: 'Nişancı Düellosu',
        points: 30,
        status: 'finished',
        winner: 'Bob', // stored winner
        gameState: { resolvedWinner: 'Alice', settlementApplied: true },
      },
    ];
    const deps = makeDeps({ memoryGames });
    const handler = createFinishGameHandler(deps);
    const req = { params: { id: '1' }, body: {}, user: { username: 'Alice' } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(409);
  });
});
