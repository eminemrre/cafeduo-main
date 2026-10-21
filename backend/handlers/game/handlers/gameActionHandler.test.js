const { createGameActionHandler } = require('./gameActionHandler');
const {
  createQuizPrivateState,
  createQuizPublicState,
  startQuizState,
} = require('../../../gameEngine/quizEngine');
const {
  createAimPrivateState,
  createAimPublicState,
  startAimState,
} = require('../../../gameEngine/aimEngine');
const { AIM_GAME_TYPE, QUIZ_GAME_TYPE } = require('../../../../shared/gameRegistry');
const { recordActionReceipt } = require('../../../gameEngine/actionProtocol');

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

const buildMemoryGame = (nowMs = Date.now()) => {
  const privateState = createQuizPrivateState();
  const state = startQuizState({
    state: createQuizPublicState({
      hostName: 'Alice',
      guestName: 'Bob',
      totalRounds: privateState.questions.length,
    }),
    privateState,
    hostName: 'Alice',
    guestName: 'Bob',
    nowMs,
  });
  return {
    id: 42,
    hostName: 'Alice',
    guestName: 'Bob',
    gameType: QUIZ_GAME_TYPE,
    points: 10,
    table: 'MASA01',
    status: 'active',
    winner: null,
    gameState: { engine: state },
    gamePrivateState: privateState,
    createdAt: new Date().toISOString(),
  };
};

const makeDeps = ({ games = [], memoryUsers = [], connected = false, client = null } = {}) => {
  const deps = {
    pool: {
      connect: jest.fn(async () => client),
    },
    isDbConnected: jest.fn(async () => connected),
    logger: { error: jest.fn(), warn: jest.fn() },
    getMemoryGames: () => games,
    getMemoryUsers: () => memoryUsers,
    emitRealtimeUpdate: jest.fn(),
  };
  return deps;
};

const request = (username, body) => ({
  params: { id: '42' },
  user: { username },
  body,
});

describe('gameActionHandler (memory)', () => {
  it('applies an answer, persists private state and emits only a summary', async () => {
    const game = buildMemoryGame();
    const deps = makeDeps({ games: [game] });
    const handler = createGameActionHandler(deps);
    const res = createMockRes();

    await handler(
      request('Alice', {
        actionId: 'act_host_1',
        roundId: 'r1',
        type: 'answer',
        optionIndex: 0,
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(res.payload.game.gameState.engine.players.host.answered).toBe(true);
    expect(game.gamePrivateState.responses.r1.host).toBeDefined();
    expect(deps.emitRealtimeUpdate).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ type: 'game_state_updated', revision: expect.any(Number) })
    );
    const emitted = JSON.stringify(deps.emitRealtimeUpdate.mock.calls);
    expect(emitted).not.toContain('optionIndex');
    expect(emitted).not.toContain('answerIndex');
    expect(emitted).not.toContain('questions');
    expect(emitted).not.toContain('actions');
    expect(emitted).toContain('gameState');
  });

  it('returns the same snapshot for a retry, with no second write or emit', async () => {
    const game = buildMemoryGame();
    const deps = makeDeps({ games: [game] });
    const handler = createGameActionHandler(deps);
    const body = {
      actionId: 'act_host_retry',
      roundId: 'r1',
      type: 'answer',
      optionIndex: 1,
    };

    const first = createMockRes();
    await handler(request('Alice', body), first);
    const revision = first.payload.game.gameState.engine.revision;
    deps.emitRealtimeUpdate.mockClear();

    const second = createMockRes();
    await handler(request('Alice', body), second);
    expect(second.statusCode).toBe(200);
    expect(second.payload.duplicate).toBe(true);
    expect(second.payload.game.gameState.engine.revision).toBe(revision);
    expect(deps.emitRealtimeUpdate).not.toHaveBeenCalled();
  });

  it('rejects a changed payload that reuses an action id', async () => {
    const game = buildMemoryGame();
    const handler = createGameActionHandler(makeDeps({ games: [game] }));
    const first = createMockRes();
    await handler(
      request('Alice', {
        actionId: 'act_conflict_1',
        roundId: 'r1',
        type: 'answer',
        optionIndex: 1,
      }),
      first
    );

    const second = createMockRes();
    await handler(
      request('Alice', {
        actionId: 'act_conflict_1',
        roundId: 'r1',
        type: 'answer',
        optionIndex: 2,
      }),
      second
    );
    expect(second.statusCode).toBe(409);
    expect(second.payload.code).toBe('ACTION_ID_CONFLICT');
  });

  it('rejects a non-participant and an admin who is not a player', async () => {
    const game = buildMemoryGame();
    const handler = createGameActionHandler(makeDeps({ games: [game] }));

    const outsider = createMockRes();
    await handler(
      request('Mallory', {
        actionId: 'act_outsider_1',
        roundId: 'r1',
        type: 'answer',
        optionIndex: 0,
      }),
      outsider
    );
    expect(outsider.statusCode).toBe(403);
    expect(outsider.payload.code).toBe('NOT_PARTICIPANT');

    const admin = createMockRes();
    await handler(
      {
        params: { id: '42' },
        user: { username: 'root', role: 'admin', isAdmin: true },
        body: {
          actionId: 'act_admin_1',
          roundId: 'r1',
          type: 'answer',
          optionIndex: 0,
        },
      },
      admin
    );
    expect(admin.statusCode).toBe(403);
  });

  it('rejects malformed envelopes before touching the game', async () => {
    const game = buildMemoryGame();
    const handler = createGameActionHandler(makeDeps({ games: [game] }));
    const res = createMockRes();
    await handler(
      request('Alice', { actionId: 'short', roundId: 'r1', type: 'answer', optionIndex: 0 }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('INVALID_ACTION_ID');
  });
});

describe('gameActionHandler (database)', () => {
  const makeClient = (game) => {
    const calls = [];
    const client = {
      calls,
      query: jest.fn(async (sql, params) => {
        calls.push({ sql, params });
        if (/FROM games/i.test(sql)) return { rows: [game] };
        if (/UPDATE games/i.test(sql)) {
          game.game_state = JSON.parse(params[0]);
          game.game_private_state = JSON.parse(params[1]);
          game.status = params[2];
          game.winner = params[3];
          return { rows: [{ id: game.id }] };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    return client;
  };

  const dbGame = () => {
    const memory = buildMemoryGame();
    return {
      id: memory.id,
      host_name: memory.hostName,
      guest_name: memory.guestName,
      game_type: memory.gameType,
      points: memory.points,
      status: 'active',
      winner: null,
      game_state: memory.gameState,
      game_private_state: memory.gamePrivateState,
      table_code: memory.table,
      created_at: memory.createdAt,
    };
  };

  it('locks, writes public+private state and commits after an applied action', async () => {
    const game = dbGame();
    const client = makeClient(game);
    const deps = makeDeps({ connected: true, client });
    const handler = createGameActionHandler(deps);
    const res = createMockRes();

    await handler(
      request('Alice', {
        actionId: 'act_db_1',
        roundId: 'r1',
        type: 'answer',
        optionIndex: 1,
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(client.calls[0].sql).toMatch(/BEGIN/);
    expect(client.calls.some((call) => /FOR UPDATE/.test(call.sql))).toBe(true);
    const update = client.calls.find((call) => /UPDATE games/i.test(call.sql));
    expect(update.params[1]).toContain('"responses"');
    expect(client.calls.some((call) => /COMMIT/.test(call.sql))).toBe(true);
    expect(deps.emitRealtimeUpdate).toHaveBeenCalled();
  });

  it('commits a duplicate without a write or emit', async () => {
    const game = dbGame();
    const firstClient = makeClient(game);
    const firstHandler = createGameActionHandler(
      makeDeps({ connected: true, client: firstClient })
    );
    const body = {
      actionId: 'act_db_retry',
      roundId: 'r1',
      type: 'answer',
      optionIndex: 1,
    };
    await firstHandler(request('Alice', body), createMockRes());

    const secondClient = makeClient(game);
    const secondDeps = makeDeps({ connected: true, client: secondClient });
    const secondHandler = createGameActionHandler(secondDeps);
    const res = createMockRes();
    await secondHandler(request('Alice', body), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.duplicate).toBe(true);
    expect(secondClient.calls.some((call) => /UPDATE games/i.test(call.sql))).toBe(false);
    expect(secondDeps.emitRealtimeUpdate).not.toHaveBeenCalled();
  });

  it('rolls back when the actor is not a participant', async () => {
    const client = makeClient(dbGame());
    const deps = makeDeps({ connected: true, client });
    const handler = createGameActionHandler(deps);
    const res = createMockRes();

    await handler(
      request('Mallory', {
        actionId: 'act_db_outsider',
        roundId: 'r1',
        type: 'answer',
        optionIndex: 1,
      }),
      res
    );
    expect(res.statusCode).toBe(403);
    expect(client.calls.some((call) => /ROLLBACK/.test(call.sql))).toBe(true);
    expect(deps.emitRealtimeUpdate).not.toHaveBeenCalled();
  });

  it('rejects action types that do not belong to quiz', async () => {
    const client = makeClient(dbGame());
    const handler = createGameActionHandler(makeDeps({ connected: true, client }));
    const res = createMockRes();
    await handler(
      request('Alice', {
        actionId: 'act_db_fire',
        roundId: 'r1',
        type: 'fire',
      }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('INVALID_ACTION_FOR_GAME');
    expect(client.calls.some((call) => /ROLLBACK/.test(call.sql))).toBe(true);
  });
});

describe('gameActionHandler – aim', () => {
  it('scores a fire on the server and stores only the public shot', async () => {
    const nowMs = Date.now();
    const privateState = createAimPrivateState();
    const state = startAimState({
      state: createAimPublicState({
        hostName: 'Alice',
        guestName: 'Bob',
        totalRounds: privateState.rounds.length,
      }),
      privateState,
      hostName: 'Alice',
      guestName: 'Bob',
      nowMs,
    });
    const game = {
      id: 42,
      hostName: 'Alice',
      guestName: 'Bob',
      gameType: AIM_GAME_TYPE,
      points: 10,
      table: 'MASA01',
      status: 'active',
      winner: null,
      gameState: { engine: state },
      gamePrivateState: privateState,
      createdAt: new Date().toISOString(),
    };
    const deps = makeDeps({ games: [game] });
    const handler = createGameActionHandler(deps);
    const res = createMockRes();

    await handler(
      request('Alice', {
        actionId: 'act_aim_1',
        roundId: 'r1',
        type: 'fire',
        position: 12,
        points: 3,
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(game.gamePrivateState.shots.r1.host).toMatchObject({
      position: expect.any(Number),
      points: expect.any(Number),
    });
    expect(res.payload.game.gameState.engine.round.shots).toBeUndefined();
    expect(res.payload.game.gameState.engine.players.host.score).toBe(0);
    expect(deps.emitRealtimeUpdate).toHaveBeenCalled();
  });
});

describe('gameActionHandler – settlement', () => {
  it('settles a finished game on a duplicate retry without paying twice', async () => {
    const game = buildMemoryGame();
    const envelope = {
      actionId: 'act_dup_settle',
      roundId: 'r1',
      type: 'answer',
      optionIndex: 0,
    };
    game.gamePrivateState.actions = recordActionReceipt({
      ledger: game.gamePrivateState.actions,
      actorKey: 'host',
      envelope,
      receipt: { status: 'applied', revision: 9 },
    });
    game.gameState.engine.phase = 'finished';
    game.gameState.engine.result = {
      winner: 'Alice',
      draw: false,
      reason: 'rounds_complete',
      scores: { host: 40, guest: 10 },
    };
    game.gameState.engine.players.host.score = 40;
    game.gameState.engine.players.guest.score = 10;
    const users = [
      { username: 'Alice', points: 100, wins: 0, gamesPlayed: 0 },
      { username: 'Bob', points: 40, wins: 0, gamesPlayed: 0 },
    ];
    const deps = makeDeps({ games: [game], memoryUsers: users });
    const handler = createGameActionHandler(deps);
    const res = createMockRes();

    await handler(request('Alice', envelope), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.duplicate).toBe(true);
    expect(game.status).toBe('finished');
    expect(game.gameState.engine.result).toMatchObject({
      settled: true,
      transferredPoints: 10,
    });
    expect(users[0].points).toBe(110);
    expect(users[1].points).toBe(30);
    expect(deps.emitRealtimeUpdate).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ type: 'game_state_updated', status: 'finished', winner: 'Alice' })
    );

    const retry = createMockRes();
    await handler(request('Alice', envelope), retry);
    expect(retry.statusCode).toBe(200);
    expect(users[0].points).toBe(110);
    expect(users[1].points).toBe(30);
  });
});
