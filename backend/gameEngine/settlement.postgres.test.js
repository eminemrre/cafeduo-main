/** @jest-environment node */

/**
 * Real PostgreSQL proof for the one-time settlement path.
 *
 * The unit suite mocks the pool; this suite is intentionally skipped unless
 * `TEST_DATABASE_URL` points at a disposable database with the migrations
 * applied. It exercises two independent connections, row locks and the
 * balance updates rather than SQL-shaped mocks.
 */

const { Pool } = require('pg');
const { finalizeEngineGameById } = require('./settlement');
const { createGameActionHandler } = require('../handlers/game/handlers/gameActionHandler');
const { createFinishGameHandler } = require('../handlers/game/handlers/finishGameHandler');
const { runGameEngineTick } = require('../jobs/gameEngineJobs');
const quiz = require('./quizEngine');
const aim = require('./aimEngine');

const connectionString = process.env.TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

const logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let nameCounter = 0;

const username = (tag) => `pgs_${(nameCounter += 1)}_${tag}_${runId}`.slice(0, 20);
const iso = (ms) => new Date(ms).toISOString();

const finishedEngine = ({ kind = 'quiz', host, guest, winner, hostScore, guestScore }) => ({
  version: 2,
  kind,
  revision: 50,
  phase: 'finished',
  roundIndex: kind === 'quiz' ? 10 : 5,
  totalRounds: kind === 'quiz' ? 10 : 5,
  startedAt: iso(Date.now() - 60_000),
  phaseEndsAt: iso(Date.now() - 1_000),
  updatedAt: iso(Date.now() - 1_000),
  players: {
    host: { name: host, score: hostScore, correct: kind === 'quiz' ? 9 : 0, answered: true },
    guest: { name: guest, score: guestScore, correct: kind === 'quiz' ? 6 : 0, answered: true },
  },
  result: {
    winner,
    draw: false,
    reason: kind === 'quiz' ? 'rounds_complete' : 'rounds_complete',
    scores: { host: hostScore, guest: guestScore },
  },
});

describePostgres('settlement on real PostgreSQL', () => {
  let pool;
  const createdUserIds = [];
  const createdGameIds = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString, max: 6 });
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    if (!pool) return;
    if (createdGameIds.length) {
      await pool.query('DELETE FROM games WHERE id = ANY($1::int[])', [createdGameIds]);
    }
    if (createdUserIds.length) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [createdUserIds]);
    }
    await pool.end();
  });

  const insertUser = async (points) => {
    const name = username('u');
    const result = await pool.query(
      `
        INSERT INTO users (username, email, password_hash, points, wins, games_played)
        VALUES ($1, $2, $3, $4, 0, 0)
        RETURNING id, username, points, wins, games_played
      `,
      [name, `${name}@example.com`, 'disposable-password-hash', points]
    );
    createdUserIds.push(result.rows[0].id);
    return result.rows[0];
  };

  const insertGame = async ({
    host,
    guest,
    kind = 'quiz',
    points,
    hostScore = 120,
    guestScore = 80,
    winner = host.username,
    privateState,
    state = finishedEngine({
      kind,
      host: host.username,
      guest: guest.username,
      winner,
      hostScore,
      guestScore,
    }),
  }) => {
    const result = await pool.query(
      `
        INSERT INTO games (
          host_name, guest_name, game_type, points, table_code, status,
          winner, game_state, game_private_state
        )
        VALUES ($1, $2, $3, $4, $5, 'active', NULL, $6::jsonb, $7::jsonb)
        RETURNING id
      `,
      [
        host.username,
        guest.username,
        kind === 'quiz' ? 'Bilgi Yarışı' : 'Nişancı Düellosu',
        points,
        'MASA12',
        JSON.stringify({ engine: state }),
        JSON.stringify(privateState),
      ]
    );
    createdGameIds.push(result.rows[0].id);
    return result.rows[0].id;
  };

  const appliedActions = () => ({
    version: 2,
    actions: {
      host: { act_pg_1: { status: 'applied' } },
      guest: {},
    },
  });

  const userRow = async (id) => {
    const result = await pool.query('SELECT points, wins, games_played FROM users WHERE id = $1', [
      id,
    ]);
    return result.rows[0];
  };

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
  const action = async (gameId, user, body, actionPool = pool) => {
    const res = response();
    await createGameActionHandler({
      pool: actionPool,
      isDbConnected: async () => true,
      logger,
      emitRealtimeUpdate: () => {},
    })({ params: { id: gameId }, user: { username: user.username }, body }, res);
    return res;
  };
  const liveGame = async (kind, host, guest) => {
    const privateState =
      kind === 'quiz' ? quiz.createQuizPrivateState() : aim.createAimPrivateState();
    const state = (kind === 'quiz' ? quiz.startQuizState : aim.startAimState)({
      state: (kind === 'quiz' ? quiz.createQuizPublicState : aim.createAimPublicState)({
        hostName: host.username,
        guestName: guest.username,
      }),
      privateState,
      hostName: host.username,
      guestName: guest.username,
      nowMs: Date.now(),
    });
    const id = await insertGame({ host, guest, kind, points: 10, privateState, state });
    return { id, state, privateState };
  };

  for (const kind of ['quiz', 'aim']) {
    it(`${kind}: explicitly rejects a queued pre-deadline action if a worker has already committed closure (ordering limitation)`, async () => {
      const host = await insertUser(100);
      const guest = await insertUser(100);
      const { id } = await liveGame(kind, host, guest);
      let release;
      let waiting;
      const queued = new Promise((resolve) => {
        waiting = resolve;
      });
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const delayedPool = {
        connect: async () => {
          waiting();
          await gate;
          return pool.connect();
        },
      };
      const pending = action(
        id,
        host,
        {
          actionId: `worker_first_${kind}`,
          roundId: 'r1',
          type: kind === 'quiz' ? 'answer' : 'fire',
          ...(kind === 'quiz' ? { optionIndex: 0 } : {}),
        },
        delayedPool
      );
      await queued;
      try {
        await finalizeEngineGameById({ pool, gameId: id, logger, nowMs: Date.now() + 3600000 });
      } finally {
        release();
      }
      const res = await pending;
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('GAME_FINISHED');
      const row = (
        await pool.query('SELECT status, game_state, game_private_state FROM games WHERE id = $1', [
          id,
        ])
      ).rows[0];
      expect(row.status).toBe('finished');
      expect(row.game_state.engine.result).toMatchObject({ cancelled: true, settled: true });
      expect(row.game_private_state.actions.host).toEqual({});
      expect(await userRow(host.id)).toEqual({ points: 100, wins: 0, games_played: 0 });
    });

    it(`${kind}: preserves trusted ingress time across an actual PostgreSQL row-lock wait past deadline`, async () => {
      const host = await insertUser(100);
      const guest = await insertUser(100);
      const { id, state } = await liveGame(kind, host, guest);
      const now = Date.now();
      const duration = kind === 'quiz' ? 15000 : 8000;
      state.round.startedAt = iso(now - duration + 250);
      state.round.endsAt = iso(now + 250);
      state.phaseEndsAt = state.round.endsAt;
      await pool.query('UPDATE games SET game_state = $1::jsonb WHERE id = $2', [
        JSON.stringify({ engine: state }),
        id,
      ]);
      const lock = await pool.connect();
      try {
        await lock.query('BEGIN');
        await lock.query('SELECT id FROM games WHERE id = $1 FOR UPDATE', [id]);
        const pending = action(id, host, {
          actionId: `row_wait_${kind}`,
          roundId: 'r1',
          type: kind === 'quiz' ? 'answer' : 'fire',
          ...(kind === 'quiz' ? { optionIndex: 0 } : {}),
        });
        await new Promise((resolve) => setTimeout(resolve, 400));
        await lock.query('COMMIT');
        const res = await pending;
        expect(res.statusCode).toBe(200);
        expect(Date.parse(res.body.game.serverReceivedAt)).toBeLessThan(
          Date.parse(state.round.endsAt)
        );
        expect(Date.now()).toBeGreaterThan(Date.parse(state.round.endsAt));
        const row = (await pool.query('SELECT game_private_state FROM games WHERE id = $1', [id]))
          .rows[0];
        const receipt =
          kind === 'quiz'
            ? row.game_private_state.responses.r1.host
            : row.game_private_state.shots.r1.host;
        expect(receipt.receivedAt).toBe(res.body.game.serverReceivedAt);
      } finally {
        await lock.query('ROLLBACK');
        lock.release();
      }
    });

    it(`${kind}: serializes concurrent same-ID and different-ID actions against real rows`, async () => {
      const host = await insertUser(100);
      const guest = await insertUser(100);
      const { id } = await liveGame(kind, host, guest);
      const body = {
        actionId: `pg_${kind}_same`,
        roundId: 'r1',
        type: kind === 'quiz' ? 'answer' : 'fire',
        ...(kind === 'quiz' ? { optionIndex: 0 } : {}),
      };
      const same = await Promise.all([action(id, host, body), action(id, host, body)]);
      expect(same.map((res) => res.statusCode)).toEqual([200, 200]);
      expect(same.map((res) => res.body.duplicate).sort()).toEqual([false, true]);
      const others = await Promise.all([
        action(id, guest, { ...body, actionId: `pg_${kind}_guest1` }),
        action(id, guest, { ...body, actionId: `pg_${kind}_guest2` }),
      ]);
      expect(others.map((res) => res.statusCode).sort()).toEqual([200, 409]);
      const row = (
        await pool.query('SELECT game_state, game_private_state FROM games WHERE id = $1', [id])
      ).rows[0];
      expect(row.game_state.engine.phase).toBe('reveal');
      expect(Object.keys(row.game_private_state.actions.host)).toHaveLength(1);
      expect(Object.keys(row.game_private_state.actions.guest)).toHaveLength(1);
      expect(row.game_state.engine.players.host.score).toBeGreaterThanOrEqual(0);
      const conflict = await action(id, host, { ...body, type: 'resign' });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.body.code).toBe('ACTION_ID_CONFLICT');
    });

    it(`${kind}: rolls back a real UPDATE failure and accepts the same actionId on retry`, async () => {
      const host = await insertUser(100);
      const guest = await insertUser(100);
      const { id } = await liveGame(kind, host, guest);
      const body = {
        actionId: `rollback_${kind}`,
        roundId: 'r1',
        type: kind === 'quiz' ? 'answer' : 'fire',
        ...(kind === 'quiz' ? { optionIndex: 0 } : {}),
      };
      // Real transaction and SQL; inject a transport/application failure AFTER
      // PostgreSQL executed UPDATE, proving ROLLBACK discards both receipts
      // and state. This is not a SQL-shaped fake database.
      const failingPool = {
        connect: async () => {
          const client = await pool.connect();
          return {
            release: () => client.release(),
            query: async (sql, params) => {
              const result = await client.query(sql, params);
              if (String(sql).includes('UPDATE games'))
                throw new Error('injected after real UPDATE');
              return result;
            },
          };
        },
      };
      expect((await action(id, host, body, failingPool)).statusCode).toBe(500);
      const rolledBack = (
        await pool.query('SELECT game_private_state FROM games WHERE id = $1', [id])
      ).rows[0];
      expect(rolledBack.game_private_state.actions.host).toEqual({});
      const retry = await action(id, host, body);
      expect(retry.statusCode).toBe(200);
      expect(retry.body.duplicate).toBe(false);
      expect((await action(id, host, body)).body.duplicate).toBe(true);
    });

    it(`${kind}: action, deadline worker and finish race never pay twice or reopen a round`, async () => {
      const host = await insertUser(100);
      const guest = await insertUser(100);
      const { id } = await liveGame(kind, host, guest);
      const finish = async () => {
        const res = response();
        await createFinishGameHandler({
          pool,
          isDbConnected: async () => true,
          logger,
          emitRealtimeUpdate: () => {},
          normalizeParticipantName: (name, game) =>
            [game.host_name, game.guest_name].includes(name) ? name : null,
          gameService: {
            findGameByIdForUpdate: async (client, gameId) =>
              (
                await client.query(
                  'SELECT id, host_name, guest_name, game_type, points, status, winner, game_state, game_private_state FROM games WHERE id = $1 FOR UPDATE',
                  [gameId]
                )
              ).rows[0],
          },
        })({ params: { id }, user: { username: host.username }, body: {} }, res);
        return res;
      };
      const [res, tick] = await Promise.all([
        action(id, host, { actionId: `race_resign_${kind}`, roundId: 'r1', type: 'resign' }),
        runGameEngineTick({
          pool,
          isDbConnected: async () => true,
          logger,
          nowMs: Date.now() + 3600000,
        }),
        finish(),
      ]);
      expect([200, 409]).toContain(res.statusCode);
      expect(tick.failed).toBe(0);
      await finalizeEngineGameById({ pool, gameId: id, logger, nowMs: Date.now() + 3600000 });
      const row = (await pool.query('SELECT status, game_state FROM games WHERE id = $1', [id]))
        .rows[0];
      expect(row.status).toBe('finished');
      expect(row.game_state.engine.result.settled).toBe(true);
      const before = [await userRow(host.id), await userRow(guest.id)];
      await Promise.all([finish(), finalizeEngineGameById({ pool, gameId: id, logger })]);
      expect([await userRow(host.id), await userRow(guest.id)]).toEqual(before);
      expect(before[0].points + before[1].points).toBe(200);
      expect(before.map((u) => u.games_played)).toEqual(
        row.game_state.engine.result.cancelled ? [0, 0] : [1, 1]
      );
    });
  }

  it('pays exactly once when two finalizers race on the same game', async () => {
    const host = await insertUser(100);
    const guest = await insertUser(50);
    const gameId = await insertGame({
      host,
      guest,
      points: 30,
      privateState: appliedActions(),
    });
    const nowMs = Date.now();

    const [first, second] = await Promise.all([
      finalizeEngineGameById({ pool, gameId, logger, nowMs }),
      finalizeEngineGameById({ pool, gameId, logger, nowMs }),
    ]);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first.status).toBe('finished');
    expect(second.status).toBe('finished');

    expect(await userRow(host.id)).toEqual({ points: 130, wins: 1, games_played: 1 });
    expect(await userRow(guest.id)).toEqual({ points: 20, wins: 0, games_played: 1 });

    const stored = await pool.query('SELECT status, winner, game_state FROM games WHERE id = $1', [
      gameId,
    ]);
    expect(stored.rows[0].status).toBe('finished');
    expect(stored.rows[0].winner).toBe(host.username);
    expect(stored.rows[0].game_state.engine.result).toMatchObject({
      winner: host.username,
      settled: true,
      stakeTransferred: 30,
    });

    await finalizeEngineGameById({ pool, gameId, logger, nowMs });
    expect(await userRow(host.id)).toEqual({ points: 130, wins: 1, games_played: 1 });
    expect(await userRow(guest.id)).toEqual({ points: 20, wins: 0, games_played: 1 });
  });

  it('settles two different games for the same users without a deadlock', async () => {
    const host = await insertUser(100);
    const guest = await insertUser(100);
    const firstGame = await insertGame({
      host,
      guest,
      points: 30,
      privateState: appliedActions(),
    });
    const secondGame = await insertGame({
      host: guest,
      guest: host,
      kind: 'aim',
      points: 20,
      hostScore: 9,
      guestScore: 4,
      privateState: appliedActions(),
    });

    await Promise.all([
      finalizeEngineGameById({ pool, gameId: firstGame, logger }),
      finalizeEngineGameById({ pool, gameId: secondGame, logger }),
    ]);

    expect(await userRow(host.id)).toEqual({ points: 110, wins: 1, games_played: 2 });
    expect(await userRow(guest.id)).toEqual({ points: 90, wins: 1, games_played: 2 });
  });

  it('cancels an abandoned match without paying or counting it', async () => {
    const host = await insertUser(100);
    const guest = await insertUser(50);
    const gameId = await insertGame({
      host,
      guest,
      points: 30,
      privateState: { version: 2, actions: { host: {}, guest: {} } },
    });

    const finalized = await finalizeEngineGameById({ pool, gameId, logger });
    expect(finalized.status).toBe('finished');
    expect(finalized.winner).toBeNull();

    expect(await userRow(host.id)).toEqual({ points: 100, wins: 0, games_played: 0 });
    expect(await userRow(guest.id)).toEqual({ points: 50, wins: 0, games_played: 0 });

    const stored = await pool.query('SELECT status, winner, game_state FROM games WHERE id = $1', [
      gameId,
    ]);
    expect(stored.rows[0].status).toBe('finished');
    expect(stored.rows[0].winner).toBeNull();
    expect(stored.rows[0].game_state.engine.result).toMatchObject({
      cancelled: true,
      reason: 'abandoned',
      settled: true,
      stakeTransferred: 0,
    });
  });
});
