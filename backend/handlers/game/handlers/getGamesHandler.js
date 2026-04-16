/**
 * Get Games Handler
 * Handles listing waiting games with scope filtering and cache support
 */

const { isAdminActor } = require('../validation');

const createGetGamesHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    normalizeTableCode,
    supportedGameTypes,
    gameService,
    getMemoryGames,
  } = deps;

  const getGames = async (req, res) => {
    const adminActor = isAdminActor(req.user);
    const actorTableCode = normalizeTableCode(req.user?.table_number);
    const actorCafeId = Number(req.user?.cafe_id || 0);
    const requestedTableCode = normalizeTableCode(req.query?.table);
    const scopeAllRequested = String(req.query?.scope || '').trim().toLowerCase() === 'all';
    const hasCheckIn =
      actorCafeId > 0 &&
      Boolean(actorTableCode);

    // Use gameService if available (with lobby cache)
    if (gameService && typeof gameService.listWaitingGames === 'function') {
      const games = await gameService.listWaitingGames({
        adminActor,
        hasCheckIn,
        actorCafeId,
        actorTableCode,
        requestedTableCode,
        scopeAllRequested,
      });
      return res.json(games);
    }

    // Fallback: Direct DB/memory query if service not injected
    if (!adminActor && !hasCheckIn) {
      return res.json([]);
    }

    if (await isDbConnected()) {
      const result = await pool.query(
        `
          SELECT
            id,
            host_name as "hostName",
            game_type as "gameType",
            points,
            table_code as "table",
            status,
            guest_name as "guestName",
            created_at as "createdAt"
          FROM games
          WHERE status = 'waiting'
            AND game_type = ANY($1::text[])
          ORDER BY created_at DESC
        `,
        [[...supportedGameTypes]]
      );
      return res.json(result.rows);
    }

    // Memory fallback
    return res.json(
      getMemoryGames().filter((game) => String(game.status || '').toLowerCase() === 'waiting')
    );
  };

  return getGames;
};

module.exports = {
  createGetGamesHandler,
};
