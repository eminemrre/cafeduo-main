/**
 * Get Game State Handler
 * Handles fetching current game state with timeout detection
 */

const { isAdminActor } = require('../validation');
const { GAME_STATUS, assertGameStatusTransition } = require('../../../utils/gameStateMachine');

const createGetGameStateHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    buildChessTimeoutResolution,
    getMemoryGames,
    emitRealtimeUpdate,
  } = deps;

  const getGameState = async (req, res) => {
    const { id } = req.params;
    const actor = String(req.user?.username || '').trim().toLowerCase();
    const adminActor = isAdminActor(req.user);
    if (await isDbConnected()) {
      const baseSelectQuery = `
        SELECT
          id,
          host_name as "hostName",
          game_type as "gameType",
          points,
          table_code as "table",
          status,
          guest_name as "guestName",
          winner,
          player1_move as "player1Move",
          player2_move as "player2Move",
          game_state as "gameState",
          created_at as "createdAt"
        FROM games
        WHERE id = $1
      `;

      const result = await pool.query(baseSelectQuery, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Game not found' });
      }

      let row = result.rows[0];
      const host = String(row.hostName || '').trim().toLowerCase();
      const guest = String(row.guestName || '').trim().toLowerCase();
      if (!adminActor && actor && actor !== host && actor !== guest) {
        return res.status(403).json({ error: 'Bu oyunun detaylarını görme yetkin yok.' });
      }

      const timeoutResolution = buildChessTimeoutResolution({
        gameType: row.gameType,
        status: row.status,
        hostName: row.hostName,
        guestName: row.guestName,
        gameState: row.gameState,
      });

      if (timeoutResolution) {
        const updateResult = await pool.query(
          `
            UPDATE games
            SET status = 'finished',
                winner = $2::text,
                game_state = $3::jsonb
            WHERE id = $1
              AND status = 'active'
            RETURNING
              id,
              host_name as "hostName",
              game_type as "gameType",
              points,
              table_code as "table",
              status,
              guest_name as "guestName",
              winner,
              player1_move as "player1Move",
              player2_move as "player2Move",
              game_state as "gameState",
              created_at as "createdAt"
          `,
          [id, timeoutResolution.winner, JSON.stringify(timeoutResolution.nextGameState)]
        );

        if (updateResult.rows.length > 0) {
          row = updateResult.rows[0];
          emitRealtimeUpdate(id, {
            type: 'game_finished',
            gameId: id,
            status: 'finished',
            winner: timeoutResolution.winner,
            reason: 'timeout',
            chess: timeoutResolution.nextChessState,
            gameState: timeoutResolution.nextGameState,
          });
        } else {
          const refreshed = await pool.query(baseSelectQuery, [id]);
          if (refreshed.rows.length > 0) {
            row = refreshed.rows[0];
          }
        }
      }

      return res.json(row);
    }

    const game = getMemoryGames().find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    const host = String(game.hostName || '').trim().toLowerCase();
    const guest = String(game.guestName || '').trim().toLowerCase();
    if (!adminActor && actor && actor !== host && actor !== guest) {
      return res.status(403).json({ error: 'Bu oyunun detaylarını görme yetkin yok.' });
    }

    const timeoutResolution = buildChessTimeoutResolution({
      gameType: game.gameType,
      status: game.status,
      hostName: game.hostName,
      guestName: game.guestName,
      gameState: game.gameState,
    });

    if (timeoutResolution) {
      const timeoutTransition = assertGameStatusTransition({
        fromStatus: game.status,
        toStatus: GAME_STATUS.FINISHED,
        context: 'chess_timeout_read_memory',
      });
      if (timeoutTransition.ok) {
        game.status = GAME_STATUS.FINISHED;
        game.winner = timeoutResolution.winner;
        game.gameState = timeoutResolution.nextGameState;
        emitRealtimeUpdate(id, {
          type: 'game_finished',
          gameId: id,
          status: game.status,
          winner: timeoutResolution.winner,
          reason: 'timeout',
          chess: timeoutResolution.nextChessState,
          gameState: timeoutResolution.nextGameState,
        });
      }
    }

    return res.json(game);
  };

  return getGameState;
};

module.exports = { createGetGameStateHandler };
