/**
 * Delete Game Handler
 * Handles game deletion with authorization checks
 */

const { isAdminActor } = require('../validation');

const createDeleteGameHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    lobbyCacheService,
    getMemoryGames,
    setMemoryGames,
    emitLobbyUpdate,
  } = deps;

  const deleteGame = async (req, res) => {
    const { id } = req.params;

    if (await isDbConnected()) {
      const result = await pool.query(
        `
          DELETE FROM games
          WHERE id = $1
            AND (
              LOWER(host_name) = LOWER($2)
              OR LOWER(COALESCE(guest_name, '')) = LOWER($2)
              OR $3 = true
            )
          RETURNING id, table_code
        `,
        [id, req.user?.username || '', isAdminActor(req.user)]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Oyun bulunamadı veya silme yetkiniz yok.' });
      }
      
      const deletedGame = result.rows[0];
      
      // Cache invalidation - oyun silindi
      lobbyCacheService?.onGameDeleted({
        tableCode: deletedGame.table_code,
      }).catch((err) => {
        logger.warn(`Cache invalidation failed on game deleted: ${err.message}`);
      });
      
      emitLobbyUpdate({
        action: 'game_deleted',
        gameId: id,
        tableCode: deletedGame.table_code,
      });
      return res.json({ success: true });
    }

    const currentGames = getMemoryGames();
    let deletedTableCode = null;
    const nextGames = currentGames.filter((game) => {
      if (String(game.id) !== String(id)) return true;
      deletedTableCode = game.table;
      if (isAdminActor(req.user)) return false;
      const actor = String(req.user?.username || '').toLowerCase();
      return String(game.hostName || '').toLowerCase() !== actor && String(game.guestName || '').toLowerCase() !== actor;
    });
    if (nextGames.length === currentGames.length) {
      return res.status(404).json({ error: 'Oyun bulunamadı veya silme yetkiniz yok.' });
    }
    setMemoryGames(nextGames);
    emitLobbyUpdate({
      action: 'game_deleted',
      gameId: id,
      tableCode: deletedTableCode,
    });
    return res.json({ success: true });
  };

  return deleteGame;
};

module.exports = { createDeleteGameHandler };
