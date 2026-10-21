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

const connectionString = process.env.TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

const logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let nameCounter = 0;

const username = (tag) => `pgs_${runId}_${tag}_${(nameCounter += 1)}`.slice(0, 20);
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
      host,
      guest,
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

    expect(await userRow(host.id)).toEqual({ points: 150, wins: 2, games_played: 2 });
    expect(await userRow(guest.id)).toEqual({ points: 50, wins: 0, games_played: 2 });
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
