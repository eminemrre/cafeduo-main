/**
 * Advances and settles expired competitive engine games.
 *
 * The read and action paths can also move the clock, but neither is allowed
 * to leave a match open forever when both clients disconnect. This job scans
 * a bounded batch, locks one row per transaction in the settlement service,
 * and is safe to run on every server instance: the row lock plus the
 * `result.settled` flag make a duplicate run a no-op.
 */

const { COMPETITIVE_ENGINE_GAME_TYPES } = require('../utils/gameEngineConfig');
const { finalizeEngineGameById } = require('../gameEngine/settlement');

const ENGINE_TICK_INTERVAL_MS = 2_000;
const ENGINE_BATCH_SIZE = 50;

const runGameEngineTick = async ({
  pool,
  isDbConnected,
  logger,
  nowMs = Date.now(),
  batchSize = ENGINE_BATCH_SIZE,
}) => {
  if (!(await isDbConnected())) return { processed: 0, failed: 0 };
  const gameTypes = Array.from(COMPETITIVE_ENGINE_GAME_TYPES);
  const nowIso = new Date(nowMs).toISOString();

  const candidates = await pool.query(
    `
      SELECT id
      FROM games
      WHERE status IN ('active', 'finished')
        AND game_type = ANY($1::text[])
        AND game_state->'engine' IS NOT NULL
        AND (
          (
            game_state->'engine'->>'phase' IN ('open', 'reveal')
            AND game_state->'engine'->>'phaseEndsAt' <= $2::text
          )
          OR (
            game_state->'engine'->>'phase' = 'finished'
            AND COALESCE(game_state->'engine'->'result'->>'settled', 'false') <> 'true'
          )
        )
      ORDER BY id
      LIMIT $3
    `,
    [gameTypes, nowIso, batchSize]
  );

  let processed = 0;
  let failed = 0;
  for (const row of candidates.rows) {
    try {
      await finalizeEngineGameById({ pool, gameId: row.id, logger, nowMs });
      processed += 1;
    } catch (err) {
      failed += 1;
      logger.error('Game engine tick failed', {
        gameId: row.id,
        error: err?.message || String(err),
      });
    }
  }
  return { processed, failed };
};

const registerGameEngineJobs = ({ pool, isDbConnected, logger }) => {
  const runSafely = () =>
    Promise.resolve()
      .then(() => runGameEngineTick({ pool, isDbConnected, logger }))
      .catch((err) => logger.error('Game engine job failed:', err));

  const timer = setInterval(runSafely, ENGINE_TICK_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return {
    stop: () => clearInterval(timer),
  };
};

module.exports = {
  ENGINE_BATCH_SIZE,
  ENGINE_TICK_INTERVAL_MS,
  registerGameEngineJobs,
  runGameEngineTick,
};
