/** @jest-environment node */
/** Real PostgreSQL transactions and independent connections, never SQL mocks. */
const { Pool } = require('pg');
const { createEnginePrivateState, startEngineState } = require('./engines');
const { BATTLESHIP_GAME_TYPE } = require('../../shared/gameRegistry');
const { validateLayout, PLACEMENT_MS, TURN_MS } = require('../../shared/battleship');
const { createGameActionHandler } = require('../handlers/game/handlers/gameActionHandler');
const { createFinishGameHandler } = require('../handlers/game/handlers/finishGameHandler');
const { finalizeEngineGameById } = require('./settlement');
const { runGameEngineTick } = require('../jobs/gameEngineJobs');

const connectionString = process.env.TEST_DATABASE_URL;
const describeDb = connectionString ? describe : describe.skip;
const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
const HOST = [
  { cell: 0, dir: 'h' },
  { cell: 16, dir: 'v' },
  { cell: 21, dir: 'h' },
  { cell: 55, dir: 'v' },
];
const GUEST = [
  { cell: 56, dir: 'h' },
  { cell: 31, dir: 'v' },
  { cell: 18, dir: 'v' },
  { cell: 36, dir: 'h' },
];

describeDb('Amiral Battı on disposable PostgreSQL', () => {
  let pool;
  const ids = [];
  const userIds = [];
  let sequence = 0;
  const run = Date.now().toString(36);
  const response = () => ({
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });

  beforeAll(async () => {
    pool = new Pool({
      connectionString,
      max: 6,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    });
    await pool.query('SELECT 1');
  });
  afterAll(async () => {
    if (!pool) return;
    try {
      if (ids.length) await pool.query('DELETE FROM games WHERE id = ANY($1::int[])', [ids]);
      if (userIds.length)
        await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [userIds]);
    } finally {
      await pool.end();
    }
  });

  const fixture = async () => {
    sequence += 1;
    const names = [`bs_${sequence}_h_${run}`, `bs_${sequence}_g_${run}`];
    const inserted = await pool.query(
      `INSERT INTO users (username, email, password_hash, points, wins, games_played)
       SELECT name, name || '@example.com', 'disposable-only', 100, 0, 0
       FROM UNNEST($1::text[]) AS name RETURNING id, username`,
      [names]
    );
    userIds.push(...inserted.rows.map((u) => u.id));
    const privateState = createEnginePrivateState(BATTLESHIP_GAME_TYPE);
    privateState.firstTurn = 'host';
    const state = startEngineState({
      gameType: BATTLESHIP_GAME_TYPE,
      privateState,
      hostName: names[0],
      guestName: names[1],
    });
    const result = await pool.query(
      `INSERT INTO games (host_name, guest_name, game_type, points, table_code, status, game_state, game_private_state)
       VALUES ($1, $2, $3, 40, 'MASA14', 'active', $4::jsonb, $5::jsonb) RETURNING id`,
      [
        names[0],
        names[1],
        BATTLESHIP_GAME_TYPE,
        JSON.stringify({ engine: state }),
        JSON.stringify(privateState),
      ]
    );
    const id = result.rows[0].id;
    ids.push(id);
    return { id, host: names[0], guest: names[1], state, privateState };
  };
  const row = async (id) =>
    (
      await pool.query(
        'SELECT id, status, winner, game_state, game_private_state FROM games WHERE id = $1',
        [id]
      )
    ).rows[0];
  const balances = async (game) =>
    (
      await pool.query(
        'SELECT username, points, wins, games_played FROM users WHERE username = ANY($1::text[]) ORDER BY username LIMIT 2',
        [[game.host, game.guest]]
      )
    ).rows;
  const action = async (game, username, body, actionPool = pool) => {
    const res = response();
    await createGameActionHandler({
      pool: actionPool,
      isDbConnected: async () => true,
      logger,
      emitRealtimeUpdate: () => {},
    })({ params: { id: game.id }, user: { username }, body }, res);
    return res;
  };
  const place = async (game) => {
    expect(
      (
        await action(game, game.host, {
          actionId: 'pg_place_host',
          roundId: 'r1',
          type: 'place',
          layout: HOST,
        })
      ).statusCode
    ).toBe(200);
    expect(
      (
        await action(game, game.guest, {
          actionId: 'pg_place_guest',
          roundId: 'r1',
          type: 'place',
          layout: GUEST,
        })
      ).statusCode
    ).toBe(200);
  };
  const finish = async (game) => {
    const res = response();
    await createFinishGameHandler({
      pool,
      isDbConnected: async () => true,
      logger,
      emitRealtimeUpdate: () => {},
      normalizeParticipantName: (name, g) =>
        [g.host_name, g.guest_name].includes(name) ? name : null,
      gameService: {
        findGameByIdForUpdate: async (client, id) =>
          (
            await client.query(
              'SELECT id, host_name, guest_name, game_type, points, status, winner, game_state, game_private_state FROM games WHERE id = $1 FOR UPDATE',
              [id]
            )
          ).rows[0],
      },
    })({ params: { id: game.id }, user: { username: game.host }, body: {} }, res);
    return res;
  };

  it('serializes simultaneous fleet submissions and an identical placement retry', async () => {
    const game = await fixture();
    const host = { actionId: 'pg_same_placement', roundId: 'r1', type: 'place', layout: HOST };
    const results = await Promise.all([
      action(game, game.host, host),
      action(game, game.host, host),
      action(game, game.guest, { ...host, actionId: 'pg_guest_placement', layout: GUEST }),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200]);
    expect(
      results
        .slice(0, 2)
        .map((r) => r.body.duplicate)
        .sort()
    ).toEqual([false, true]);
    const stored = await row(game.id);
    expect(stored.game_state.engine.phase).toBe('battle');
    expect(stored.game_state.engine.round.id).toBe('r2');
    expect(stored.game_private_state.fleets.host).toEqual(validateLayout(HOST).ships);
    expect(stored.game_private_state.fleets.guest).toEqual(validateLayout(GUEST).ships);
    expect(JSON.stringify(results[2].body.game.actorView)).not.toContain('0,1,2,3');
  });

  it('applies an identical concurrent fire only once and rejects a changed payload', async () => {
    const game = await fixture();
    await place(game);
    const body = { actionId: 'pg_same_fire', roundId: 'r2', type: 'fire', cell: 36 };
    const replies = await Promise.all([
      action(game, game.host, body),
      action(game, game.host, body),
    ]);
    expect(replies.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(replies.map((r) => r.body.duplicate).sort()).toEqual([false, true]);
    const stored = await row(game.id);
    expect(stored.game_state.engine.boards.guest.shots).toEqual([{ cell: 36, hit: true }]);
    expect(stored.game_state.engine.players.host.hits).toBe(1);
    expect(stored.game_state.engine.round.id).toBe('r3');
    const conflict = await action(game, game.host, { ...body, cell: 37 });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.body.code).toBe('ACTION_ID_CONFLICT');
  });

  it('accepts only one of two different action IDs targeting the same turn', async () => {
    const game = await fixture();
    await place(game);
    const body = { actionId: 'pg_first_fire', roundId: 'r2', type: 'fire', cell: 36 };
    const replies = await Promise.all([
      action(game, game.host, body),
      action(game, game.host, { ...body, actionId: 'pg_second_fire', cell: 37 }),
    ]);
    expect(replies.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const stored = await row(game.id);
    expect(stored.game_state.engine.boards.guest.shots).toHaveLength(1);
    expect(stored.game_state.engine.players.host.hits).toBe(1);
  });

  it('rolls back both fleet and receipt after a real UPDATE, then retries the same ID', async () => {
    const game = await fixture();
    const failingPool = {
      connect: async () => {
        const client = await pool.connect();
        return {
          release: () => client.release(),
          query: async (sql, params) => {
            const result = await client.query(sql, params);
            if (String(sql).includes('UPDATE games'))
              throw new Error('injected after actual UPDATE');
            return result;
          },
        };
      },
    };
    const body = { actionId: 'pg_rollback_place', roundId: 'r1', type: 'place', layout: HOST };
    expect((await action(game, game.host, body, failingPool)).statusCode).toBe(500);
    const before = await row(game.id);
    expect(before.game_private_state.fleets.host).toBeNull();
    expect(before.game_private_state.actions.host).toEqual({});
    const retry = await action(game, game.host, body);
    expect(retry.statusCode).toBe(200);
    expect(retry.body.duplicate).toBe(false);
    expect((await action(game, game.host, body)).body.duplicate).toBe(true);
  });

  it('persists auto placement and anchors the next turn to the old deadline after restart', async () => {
    const game = await fixture();
    await action(game, game.host, {
      actionId: 'pg_partial_place',
      roundId: 'r1',
      type: 'place',
      layout: HOST,
    });
    const deadline = Date.parse(game.state.round.endsAt);
    await finalizeEngineGameById({ pool, gameId: game.id, logger, nowMs: deadline + 5000 });
    const stored = await row(game.id);
    expect(stored.game_state.engine.players.guest).toMatchObject({
      placed: true,
      autoPlaced: true,
    });
    expect(stored.game_state.engine.round.startedAt).toBe(new Date(deadline).toISOString());
    expect(stored.game_state.engine.round.endsAt).toBe(new Date(deadline + TURN_MS).toISOString());
    expect(stored.game_private_state.autoLayouts.guest).toEqual(
      game.privateState.autoLayouts.guest
    );
  });

  it('closes abandoned placement through the real deadline job with no wallet/stat change', async () => {
    const game = await fixture();
    const tick = await runGameEngineTick({
      pool,
      isDbConnected: async () => true,
      logger,
      nowMs: Date.now() + PLACEMENT_MS + 3600000,
    });
    expect(tick.failed).toBe(0);
    expect((await row(game.id)).game_state.engine.result).toMatchObject({
      cancelled: true,
      settled: true,
      reason: 'abandoned',
    });
    for (const user of await balances(game))
      expect(user).toMatchObject({ points: 100, wins: 0, games_played: 0 });
  });

  it('last shot + worker + finish race transfers at most one stake and never reopens a turn', async () => {
    const game = await fixture();
    await place(game);
    const stored = await row(game.id);
    const engine = stored.game_state.engine;
    const ships = stored.game_private_state.fleets.guest;
    const cells = ships.flatMap((s) => s.cells);
    const lastCell = cells[cells.length - 1];
    engine.boards.guest.shots = cells.slice(0, -1).map((cell) => ({ cell, hit: true }));
    engine.boards.guest.sunk = ships.slice(0, -1).map(({ size, cells }) => ({ size, cells }));
    engine.players.host.hits = cells.length - 1;
    await pool.query('UPDATE games SET game_state = $1::jsonb WHERE id = $2', [
      JSON.stringify({ engine }),
      game.id,
    ]);
    const [shot, tick, result] = await Promise.all([
      action(game, game.host, {
        actionId: 'pg_final_shot',
        roundId: 'r2',
        type: 'fire',
        cell: lastCell,
      }),
      runGameEngineTick({
        pool,
        isDbConnected: async () => true,
        logger,
        nowMs: Date.now() + 3600000,
      }),
      finish(game),
    ]);
    expect([200, 409]).toContain(shot.statusCode);
    expect([200, 409]).toContain(result.statusCode);
    expect(tick.failed).toBe(0);
    await finalizeEngineGameById({ pool, gameId: game.id, logger, nowMs: Date.now() + 3600000 });
    const terminal = await row(game.id);
    expect(terminal.status).toBe('finished');
    expect(terminal.game_state.engine.result).toMatchObject({
      settled: true,
      transferredPoints: 40,
    });
    if (shot.statusCode === 200) expect(terminal.winner).toBe(game.host);
    const before = await balances(game);
    expect(before.map((u) => u.points).sort((a, b) => a - b)).toEqual([60, 140]);
    expect(before.map((u) => u.games_played)).toEqual([1, 1]);
    expect(before.reduce((sum, u) => sum + u.wins, 0)).toBe(1);
    await Promise.all([finish(game), finalizeEngineGameById({ pool, gameId: game.id, logger })]);
    expect(await balances(game)).toEqual(before);
  });
});
