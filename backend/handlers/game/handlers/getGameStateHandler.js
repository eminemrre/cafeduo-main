/**
 * Get Game State Handler
 * Handles fetching current game state with timeout detection
 */

const { isAdminActor } = require('../validation');
const { GAME_STATUS, assertGameStatusTransition } = require('../../../utils/gameStateMachine');
const { serializeGameForActor } = require('../../../gameEngine/gameView');
const { syncCompetitiveGame } = require('../../../gameEngine/engineActions');
const { defaultRegistry } = require('../../../gameEngine/gameLock');

const createGetGameStateHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger: _logger,
    buildChessTimeoutResolution,
    getMemoryGames,
    emitRealtimeUpdate,
  } = deps;

  const getGameState = async (req, res) => {
    const { id } = req.params;
    const actor = String(req.user?.username || '')
      .trim()
      .toLowerCase();
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
          game_private_state as "gamePrivateState",
          created_at as "createdAt"
        FROM games
        WHERE id = $1
      `;

      const result = await pool.query(baseSelectQuery, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Game not found' });
      }

      let row = result.rows[0];
      const host = String(row.hostName || '')
        .trim()
        .toLowerCase();
      const guest = String(row.guestName || '')
        .trim()
        .toLowerCase();
      if (!adminActor && actor && actor !== host && actor !== guest) {
        return res.status(403).json({ error: 'Bu oyunun detaylarını görme yetkin yok.' });
      }

      const engineSync = syncCompetitiveGame({ game: row, nowMs: Date.now() });
      if (engineSync.changed) {
        const nextGameState = { ...(row.gameState || {}), engine: engineSync.state };
        const updateResult = await pool.query(
          `
            UPDATE games
            SET game_state = $2::jsonb,
                status = $3::text,
                winner = $4::text
            WHERE id = $1
              AND game_state = $5::jsonb
            RETURNING id
          `,
          [
            id,
            JSON.stringify(nextGameState),
            engineSync.status,
            engineSync.winner,
            JSON.stringify(row.gameState || {}),
          ]
        );
        if (updateResult.rows.length > 0) {
          row = {
            ...row,
            gameState: nextGameState,
            status: engineSync.status,
            winner: engineSync.winner,
          };
          emitRealtimeUpdate(id, {
            type: 'game_state_updated',
            gameId: id,
            status: engineSync.status,
            revision: engineSync.state.revision,
            phase: engineSync.state.phase,
            winner: engineSync.winner,
          });
        } else {
          // An action committed between our read and this optimistic update.
          // Read again so the response reflects the action instead of
          // overwriting it.
          const refreshed = await pool.query(baseSelectQuery, [id]);
          if (refreshed.rows.length > 0) row = refreshed.rows[0];
        }
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
            gameState: serializeGameForActor({
              gameType: row.gameType,
              gameState: timeoutResolution.nextGameState,
            }).gameState,
          });
        } else {
          const refreshed = await pool.query(baseSelectQuery, [id]);
          if (refreshed.rows.length > 0) {
            row = refreshed.rows[0];
          }
        }
      }

      return res.json(serializeGameForActor(row));
    }

    const game = getMemoryGames().find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    const host = String(game.hostName || '')
      .trim()
      .toLowerCase();
    const guest = String(game.guestName || '')
      .trim()
      .toLowerCase();
    if (!adminActor && actor && actor !== host && actor !== guest) {
      return res.status(403).json({ error: 'Bu oyunun detaylarını görme yetkin yok.' });
    }

    await defaultRegistry.runExclusive(id, async () => {
      const lockedGame = getMemoryGames().find((item) => String(item.id) === String(id));
      if (!lockedGame) return;
      const memoryEngineSync = syncCompetitiveGame({ game: lockedGame, nowMs: Date.now() });
      if (!memoryEngineSync.changed) return;
      lockedGame.gameState = { ...(lockedGame.gameState || {}), engine: memoryEngineSync.state };
      lockedGame.status = memoryEngineSync.status;
      lockedGame.winner = memoryEngineSync.winner;
      emitRealtimeUpdate(id, {
        type: 'game_state_updated',
        gameId: id,
        status: memoryEngineSync.status,
        revision: memoryEngineSync.state.revision,
        phase: memoryEngineSync.state.phase,
        winner: memoryEngineSync.winner,
      });
    });

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
          gameState: serializeGameForActor({
            gameType: game.gameType,
            gameState: timeoutResolution.nextGameState,
          }).gameState,
        });
      }
    }

    return res.json(serializeGameForActor(game));
  };

  return getGameState;
};

module.exports = { createGetGameStateHandler };
