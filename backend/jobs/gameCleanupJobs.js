const STALE_WAITING_GAME_THRESHOLD_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const registerGameCleanupJobs = ({
  pool,
  isDbConnected,
  getMemoryGames,
  setMemoryGames,
  logger,
}) => {
  setInterval(async () => {
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
  }, CLEANUP_INTERVAL_MS);

  setInterval(async () => {
    if (!(await isDbConnected())) return;

    try {
      await pool.query(`
        UPDATE games
        SET status = 'finished'
        WHERE status IN ('waiting', 'active')
          AND created_at < NOW() - INTERVAL '2 hours'
      `);
    } catch (err) {
      logger.error('Cleanup error (stuck games):', err);
    }
  }, CLEANUP_INTERVAL_MS);
};

module.exports = { registerGameCleanupJobs };
