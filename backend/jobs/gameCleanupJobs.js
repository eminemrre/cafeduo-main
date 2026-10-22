const STALE_WAITING_GAME_THRESHOLD_MS = 30 * 60 * 1000;
const STUCK_GAME_THRESHOLD_HOURS = 2;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const registerGameCleanupJobs = ({
  pool,
  isDbConnected,
  getMemoryGames,
  setMemoryGames,
  logger,
}) => {
  // 1) Stale "waiting" games: never joined. Safe to delete entirely.
  // setInterval ignores the returned promise, so a rejection here would be
  // unhandled and exit the process; every tick ends in its own catch.
  const runSafely = (label, job) => () =>
    Promise.resolve()
      .then(job)
      .catch((err) => logger.error(`Cleanup job failed (${label}):`, err));

  setInterval(
    runSafely('waiting games', async () => {
      logger.info('Running cleanup job for stale waiting games.');
      const thirtyMinutesAgo = new Date(Date.now() - STALE_WAITING_GAME_THRESHOLD_MS).toISOString();

      if (await isDbConnected()) {
        try {
          const result = await pool.query(
            "DELETE FROM games WHERE status = 'waiting' AND created_at < $1 RETURNING id",
            [thirtyMinutesAgo]
          );
          if (result.rowCount > 0) {
            logger.info(`Deleted ${result.rowCount} stale waiting games from DB.`);
          }
        } catch (err) {
          logger.error('Cleanup error (waiting games):', err);
        }
        return;
      }

      const games = getMemoryGames();
      const threshold = new Date(Date.now() - STALE_WAITING_GAME_THRESHOLD_MS);
      const nextGames = games.filter((game) => {
        const createdAt = new Date(game.createdAt || Date.now());
        return game.status !== 'waiting' || createdAt > threshold;
      });

      const deletedCount = games.length - nextGames.length;
      if (deletedCount > 0) {
        logger.info(`Deleted ${deletedCount} stale waiting games from memory.`);
        setMemoryGames(nextGames);
      }
    }),
    CLEANUP_INTERVAL_MS
  );

  // 2) Stuck "active" games: started but never finished (2h+). Force-close.
  // NOTE: We close without running settlement so we never "magically" transfer
  // points based on incomplete data. Operators get a structured warning per
  // stuck row so they can inspect / replay if needed.
  setInterval(
    runSafely('stuck games', async () => {
      if (!(await isDbConnected())) return;

      try {
        const stuckResult = await pool.query(
          `
          SELECT id, host_name, guest_name, game_type, points, status, created_at, game_state
          FROM games
          WHERE status IN ('waiting', 'active')
            AND created_at < NOW() - INTERVAL '${STUCK_GAME_THRESHOLD_HOURS} hours'
            AND COALESCE(game_state ? 'engine', false) = false
        `
        );

        if (stuckResult.rowCount > 0) {
          for (const row of stuckResult.rows) {
            const settlementApplied = Boolean(row.game_state?.settlementApplied);
            logger.warn('Force-closing stuck game without settlement', {
              gameId: row.id,
              gameType: row.game_type,
              status: row.status,
              stake: row.points,
              host: row.host_name,
              guest: row.guest_name,
              createdAt: row.created_at,
              settlementApplied,
              note: settlementApplied
                ? 'settlement was already applied before timeout'
                : 'no winner could be determined; stake not transferred',
            });
          }
          await pool.query(
            `
            UPDATE games
            SET status = 'finished'
            WHERE status IN ('waiting', 'active')
              AND created_at < NOW() - INTERVAL '${STUCK_GAME_THRESHOLD_HOURS} hours'
              AND COALESCE(game_state ? 'engine', false) = false
          `
          );
          logger.info(`Force-closed ${stuckResult.rowCount} stuck game(s).`);
        }
      } catch (err) {
        logger.error('Cleanup error (stuck games):', err);
      }
    }),
    CLEANUP_INTERVAL_MS
  );
};

module.exports = { registerGameCleanupJobs };
