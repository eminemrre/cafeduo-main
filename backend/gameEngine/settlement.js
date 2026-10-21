/**
 * One-time settlement for competitive engine games (protocol v2).
 *
 * The engine already owns the winner. This module only turns a finished
 * public engine state into the balance/wins/games_played/tournament update,
 * inside the caller's transaction and row lock, and records that the result
 * was settled in the public engine state so a retry, a timeout job, a reader
 * and the finish endpoint cannot pay twice.
 */

const { applyDbSettlement, applyMemorySettlement } = require('../handlers/game/settlementUtils');
const { isCompetitiveEngineGameType } = require('../utils/gameEngineConfig');
const { syncCompetitiveGame } = require('./engineActions');

const iso = (ms) => new Date(ms).toISOString();

const FINALIZE_SELECT = `
  SELECT
    id,
    host_name,
    guest_name,
    game_type,
    points,
    table_code,
    status,
    winner,
    game_state,
    game_private_state,
    created_at,
    to_jsonb(games)->>'cafe_id' AS cafe_id,
    to_jsonb(games)->>'tournament_id' AS tournament_id
  FROM games
  WHERE id = $1
  FOR UPDATE
`;

const hasAnyAppliedAction = (privateState) => {
  const actions = privateState?.actions;
  if (!actions || typeof actions !== 'object') return false;
  return ['host', 'guest'].some((actorKey) => {
    const ledger = actions[actorKey];
    return Boolean(ledger && typeof ledger === 'object' && Object.keys(ledger).length > 0);
  });
};

const patchResult = (engineState, patch) => ({
  ...engineState,
  result: { ...(engineState.result || {}), ...patch },
});

/**
 * Decides the settlement of a finished public engine state. The caller
 * supplies the actual balance writer so DB and memory share the same rules.
 */
const settleEngineState = async ({
  game,
  engineState,
  privateState,
  applySettlement,
  nowMs = Date.now(),
}) => {
  if (!engineState || engineState.phase !== 'finished') {
    return { ok: false, code: 'SERVER_RESULT_PENDING' };
  }
  if (engineState.result?.settled) {
    return {
      ok: true,
      alreadySettled: true,
      cancelled: Boolean(engineState.result.cancelled),
      engineState,
      transferredPoints: Number(engineState.result.transferredPoints || 0),
    };
  }

  // If neither player ever produced one accepted action, nobody earned a
  // result. Close it without touching balances or even games_played.
  if (!hasAnyAppliedAction(privateState)) {
    const nextEngineState = patchResult(engineState, {
      winner: null,
      draw: true,
      cancelled: true,
      reason: 'abandoned',
      transferredPoints: 0,
      stakeTransferred: 0,
      settled: true,
      settledAt: iso(nowMs),
    });
    return {
      ok: true,
      alreadySettled: false,
      cancelled: true,
      engineState: nextEngineState,
      transferredPoints: 0,
    };
  }

  const result = engineState.result || {};
  const settlement = await applySettlement({
    game,
    winnerName: result.winner || null,
    isDraw: Boolean(result.draw),
    gameType: game.game_type || game.gameType,
  });
  const transferredPoints = Number(settlement?.transferredPoints || 0);
  const nextEngineState = patchResult(engineState, {
    settled: true,
    settledAt: iso(nowMs),
    transferredPoints,
    stakeTransferred: transferredPoints,
  });
  return {
    ok: true,
    alreadySettled: false,
    cancelled: false,
    engineState: nextEngineState,
    transferredPoints: Number(settlement?.transferredPoints || 0),
  };
};

/**
 * Settles a finished engine state and writes the game row. The caller owns
 * the transaction and must already hold the `games` row lock.
 */
const settleDbEngineGame = async ({
  client,
  game,
  gameState,
  privateState,
  logger,
  nowMs = Date.now(),
}) => {
  const engineState = gameState?.engine;
  const outcome = await settleEngineState({
    game,
    engineState,
    privateState,
    nowMs,
    applySettlement: (params) =>
      applyDbSettlement({
        client,
        ...params,
        logger,
      }),
  });
  if (!outcome.ok) return outcome;

  const nextGameState = { ...(gameState || {}), engine: outcome.engineState };
  const winner = outcome.engineState.result?.winner || null;
  await client.query(
    `
      UPDATE games
      SET game_state = $1::jsonb,
          status = 'finished',
          winner = $2::text
      WHERE id = $3
    `,
    [JSON.stringify(nextGameState), winner, game.id]
  );

  return {
    ...outcome,
    gameState: nextGameState,
    winner,
  };
};

/**
 * A DB read or the timeout job needs to advance an expired engine clock and,
 * if that completes the match, settle it in the same transaction.
 */
const finalizeEngineGameById = async ({ pool, gameId, logger, nowMs = Date.now() }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(FINALIZE_SELECT, [gameId]);
    const game = result.rows[0];
    if (!game) {
      await client.query('ROLLBACK');
      return null;
    }

    if (!isCompetitiveEngineGameType(game.game_type)) {
      await client.query('ROLLBACK');
      return game;
    }

    const sync = syncCompetitiveGame({ game, nowMs });
    const gameState = sync.changed
      ? { ...(game.game_state || {}), engine: sync.state }
      : game.game_state && typeof game.game_state === 'object'
        ? game.game_state
        : {};
    const engineState = gameState.engine;

    if (engineState?.phase === 'finished') {
      const settled = await settleDbEngineGame({
        client,
        game,
        gameState,
        privateState: game.game_private_state,
        logger,
        nowMs,
      });
      await client.query('COMMIT');
      return {
        ...game,
        game_state: settled.gameState,
        status: 'finished',
        winner: settled.winner,
      };
    }

    if (sync.changed) {
      await client.query(
        `
          UPDATE games
          SET game_state = $1::jsonb,
              status = $2::text,
              winner = $3::text
          WHERE id = $4
        `,
        [JSON.stringify(gameState), sync.status || game.status, sync.winner || null, gameId]
      );
    }
    await client.query('COMMIT');
    return {
      ...game,
      game_state: gameState,
      status: sync.changed ? sync.status || game.status : game.status,
      winner: sync.changed ? sync.winner || null : game.winner,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Memory equivalent. The caller must hold the per-game lock.
 */
const finalizeMemoryEngineGame = ({ game, privateState, getMemoryUsers, nowMs = Date.now() }) => {
  const sync = syncCompetitiveGame({ game, nowMs });
  if (sync.changed) {
    game.gameState = { ...(game.gameState || {}), engine: sync.state };
    game.status = sync.status || game.status;
    game.winner = sync.winner || null;
  }

  const engineState = game.gameState?.engine;
  if (engineState?.phase !== 'finished') {
    return { changed: sync.changed, settled: false, cancelled: false };
  }

  if (engineState.result?.settled) {
    return {
      changed: sync.changed,
      settled: true,
      cancelled: Boolean(engineState.result.cancelled),
    };
  }

  // Synchronous memory settlement is deliberate: there is no await between
  // the settled check and the balance writes, and the caller's game lock
  // serializes concurrent actions.
  if (!hasAnyAppliedAction(privateState)) {
    game.gameState = {
      ...game.gameState,
      engine: patchResult(engineState, {
        winner: null,
        draw: true,
        cancelled: true,
        reason: 'abandoned',
        transferredPoints: 0,
        settled: true,
        settledAt: iso(nowMs),
      }),
    };
    game.status = 'finished';
    game.winner = null;
    return { changed: true, settled: true, cancelled: true };
  }

  const result = engineState.result || {};
  const settlement = applyMemorySettlement({
    game,
    winnerName: result.winner || null,
    isDraw: Boolean(result.draw),
    gameType: game.gameType,
    getMemoryUsers,
  });
  game.gameState = {
    ...game.gameState,
    engine: patchResult(engineState, {
      settled: true,
      settledAt: iso(nowMs),
      transferredPoints: Number(settlement?.transferredPoints || 0),
      stakeTransferred: Number(settlement?.transferredPoints || 0),
    }),
  };
  game.status = 'finished';
  game.winner = result.winner || null;
  return { changed: true, settled: true, cancelled: false };
};

module.exports = {
  finalizeEngineGameById,
  finalizeMemoryEngineGame,
  hasAnyAppliedAction,
  settleDbEngineGame,
  settleEngineState,
};
