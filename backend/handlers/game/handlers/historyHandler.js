/**
 * User Game History Handler
 * Handles fetching game history for a user
 */

const { isAdminActor } = require('../validation');

const createHistoryHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    supportedGameTypes,
    getMemoryGames,
  } = deps;

  const getUserGameHistory = async (req, res) => {
    const targetUsername = String(req.params?.username || '').trim();
    const actorUsername = String(req.user?.username || '').trim();
    const adminActor = isAdminActor(req.user);

    if (!targetUsername) {
      return res.status(400).json({ error: 'username zorunludur.' });
    }

    if (!adminActor && actorUsername.toLowerCase() !== targetUsername.toLowerCase()) {
      return res.status(403).json({ error: 'Sadece kendi oyun geçmişini görüntüleyebilirsin.' });
    }

    const mapHistoryRow = (game) => {
      const hostName = String(game.hostName || game.host_name || '').trim();
      const guestName = String(game.guestName || game.guest_name || '').trim();
      const actorLower = targetUsername.toLowerCase();
      const isHost = hostName.toLowerCase() === actorLower;
      const opponentName = isHost ? guestName || 'Rakip' : hostName || 'Rakip';
      const winner = game.winner ? String(game.winner) : null;
      const gameState = game.gameState && typeof game.gameState === 'object' ? game.gameState : {};
      const chessState = gameState.chess && typeof gameState.chess === 'object' ? gameState.chess : {};
      const moveHistory = Array.isArray(chessState.moveHistory) ? chessState.moveHistory : [];
      const clockState = chessState.clock && typeof chessState.clock === 'object' ? chessState.clock : {};
      const baseMs = Number(clockState.baseMs);
      const incrementMs = Number(clockState.incrementMs);
      const tempoLabel =
        Number.isFinite(baseMs) && Number.isFinite(incrementMs)
          ? `${Math.round(baseMs / 60000)}+${Math.round(incrementMs / 1000)}`
          : null;

      return {
        id: game.id,
        gameType: String(game.gameType || game.game_type || ''),
        points: Math.max(0, Number(game.points || 0)),
        table: String(game.table || game.table_code || ''),
        status: String(game.status || ''),
        winner,
        didWin: Boolean(winner) && winner.toLowerCase() === targetUsername.toLowerCase(),
        opponentName,
        createdAt: game.createdAt || game.created_at || new Date().toISOString(),
        moveCount: moveHistory.length,
        chessTempo: tempoLabel,
      };
    };

    if (await isDbConnected()) {
      try {
        const result = await pool.query(
          `
            SELECT
              id,
              host_name as "hostName",
              guest_name as "guestName",
              game_type as "gameType",
              points,
              table_code as "table",
              status,
              winner,
              game_state as "gameState",
              created_at as "createdAt"
            FROM games
            WHERE status = 'finished'
              AND game_type = ANY($2::text[])
              AND (
                LOWER(host_name) = LOWER($1)
                OR LOWER(COALESCE(guest_name, '')) = LOWER($1)
              )
            ORDER BY created_at DESC
            LIMIT 25
          `,
          [targetUsername, [...supportedGameTypes]]
        );

        return res.json(result.rows.map(mapHistoryRow));
      } catch (err) {
        logger.error('Get game history error', err);
        return res.status(500).json({ error: 'Oyun geçmişi yüklenemedi.' });
      }
    }

    const history = getMemoryGames()
      .filter((game) => {
        const status = String(game.status || '').toLowerCase();
        if (status !== 'finished') return false;
        if (!supportedGameTypes.has(String(game.gameType || '').trim())) return false;
        const hostLower = String(game.hostName || '').toLowerCase();
        const guestLower = String(game.guestName || '').toLowerCase();
        return hostLower === targetUsername.toLowerCase() || guestLower === targetUsername.toLowerCase();
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 25)
      .map(mapHistoryRow);

    return res.json(history);
  };

  return getUserGameHistory;
};

module.exports = { createHistoryHandler };
