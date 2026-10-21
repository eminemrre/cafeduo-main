#!/usr/bin/env node

/**
 * Controlled protocol-v2 transition helper.
 *
 * Default mode is a read-only dry run. It lists still-active/waiting ranked
 * quiz/aim rows that predate the v2 private engine state. Those are the only
 * rows `--apply` can retire, and retirement is idempotent:
 *
 *   - status becomes finished, winner stays null
 *   - the public engine result is marked cancelled/legacy_protocol_retired
 *   - users.points, users.wins and users.games_played are NOT touched
 *
 * `--apply` additionally requires both `--confirm-cancel-legacy` and
 * `GAME_ENGINE_V2_TRANSITION_APPROVED=1`, and never runs automatically.
 * Activation itself is a deployment/flag decision, not an action of this
 * script.
 */

import { Client } from 'pg';

const GAME_TYPES = ['Bilgi Yarışı', 'Nişancı Düellosu'];
const BATCH_LIMIT = 100;
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const confirmed = args.has('--confirm-cancel-legacy');
const approved = process.env.GAME_ENGINE_V2_TRANSITION_APPROVED === '1';
const connectionString = process.env.DATABASE_URL;

if (args.has('--help')) {
  console.log(`Usage:
  DATABASE_URL=postgresql://... npm run game-engine:transition
  DATABASE_URL=postgresql://... npm run game-engine:transition -- --apply --confirm-cancel-legacy

Environment:
  GAME_ENGINE_V2_ENABLED=true|false       shown for readiness, never changed
  GAME_ENGINE_V2_TRANSITION_APPROVED=1    required for --apply

The default is a dry run and writes nothing.`);
  process.exit(0);
}

if (!connectionString) {
  console.error('DATABASE_URL is required. Nothing was changed.');
  process.exit(1);
}

if (apply && (!confirmed || !approved)) {
  console.error(
    'Refusing --apply. Pass --confirm-cancel-legacy and set GAME_ENGINE_V2_TRANSITION_APPROVED=1 after approval.'
  );
  process.exit(1);
}

const engineKind = (gameType) => (gameType === 'Bilgi Yarışı' ? 'quiz' : 'aim');

const legacyRowsQuery = `
  SELECT
    id,
    game_type,
    status,
    host_name,
    guest_name,
    points,
    table_code,
    created_at
  FROM games
  WHERE status IN ('waiting', 'active')
    AND game_type = ANY($1::text[])
    AND COALESCE(game_private_state->>'version', '') <> '2'
  ORDER BY id
  LIMIT $2
`;

const cancellationState = (row, nowIso) => ({
  version: 2,
  kind: engineKind(row.game_type),
  revision: 1,
  phase: 'finished',
  roundIndex: 0,
  totalRounds: 0,
  startedAt: nowIso,
  phaseEndsAt: nowIso,
  updatedAt: nowIso,
  players: {
    host: {
      name: row.host_name,
      score: 0,
      roundsWon: 0,
      correct: 0,
      streak: 0,
      hits: 0,
      answered: false,
      jokerUsed: false,
      left: false,
    },
    guest: row.guest_name
      ? {
          name: row.guest_name,
          score: 0,
          roundsWon: 0,
          correct: 0,
          streak: 0,
          hits: 0,
          answered: false,
          jokerUsed: false,
          left: false,
        }
      : null,
  },
  result: {
    winner: null,
    draw: true,
    reason: 'legacy_protocol_retired',
    scores: { host: 0, guest: 0 },
    transferredPoints: 0,
    stakeTransferred: 0,
    cancelled: true,
    settled: true,
    settledAt: nowIso,
  },
});

const client = new Client({ connectionString });
let exitCode = 0;

try {
  await client.connect();
  const flag = process.env.GAME_ENGINE_V2_ENABLED === 'true' ? 'true' : 'false';
  const legacy = await client.query(legacyRowsQuery, [GAME_TYPES, BATCH_LIMIT]);
  const v2Count = await client.query(
    `SELECT COUNT(*)::int AS count
       FROM games
      WHERE status IN ('waiting', 'active')
        AND game_type = ANY($1::text[])
        AND game_private_state->>'version' = '2'`,
    [GAME_TYPES]
  );

  console.log(`mode=${apply ? 'APPLY' : 'DRY_RUN'}`);
  console.log(`GAME_ENGINE_V2_ENABLED=${flag} (informational only; this script never changes it)`);
  console.log(`legacy_active_or_waiting=${legacy.rowCount}`);
  console.log(`v2_active_or_waiting=${v2Count.rows[0]?.count || 0}`);

  for (const row of legacy.rows) {
    console.log(
      `  legacy id=${row.id} type=${row.game_type} status=${row.status} host=${row.host_name} guest=${
        row.guest_name || '-'
      } table=${row.table_code} points=${row.points}`
    );
  }

  if (!apply) {
    console.log('DRY RUN complete. No rows were changed.');
    console.log('Review the list, then ask for explicit approval before using --apply.');
  } else if (legacy.rowCount === 0) {
    console.log('APPLY complete. Nothing to retire.');
  } else {
    const nowIso = new Date().toISOString();
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT
         id,
         game_type,
         status,
         host_name,
         guest_name,
         points,
         table_code,
         created_at
       FROM games
       WHERE status IN ('waiting', 'active')
         AND game_type = ANY($1::text[])
         AND COALESCE(game_private_state->>'version', '') <> '2'
       ORDER BY id
       LIMIT $2
       FOR UPDATE SKIP LOCKED`,
      [GAME_TYPES, BATCH_LIMIT]
    );
    let retired = 0;
    for (const row of locked.rows) {
      const nextState = cancellationState(row, nowIso);
      const updated = await client.query(
        `UPDATE games
            SET status = 'finished',
                winner = NULL,
                game_state = COALESCE(game_state, '{}'::jsonb) || jsonb_build_object('engine', $1::jsonb)
          WHERE id = $2
            AND status IN ('waiting', 'active')
            AND COALESCE(game_private_state->>'version', '') <> '2'`,
        [JSON.stringify(nextState), row.id]
      );
      if (updated.rowCount === 1) {
        retired += 1;
        console.log(`  retired id=${row.id} type=${row.game_type}`);
      }
    }
    await client.query('COMMIT');
    console.log(`APPLY complete. retired=${retired}. Balances and games_played were not touched.`);
  }
} catch (error) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // The connection may have failed before BEGIN; nothing to roll back.
  }
  console.error(
    `Transition helper failed: ${error instanceof Error ? error.message : String(error)}`
  );
  exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
  process.exitCode = exitCode;
}
