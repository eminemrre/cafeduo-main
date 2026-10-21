/**
 * POST /api/games/:id/actions
 *
 * The only write path for a ranked quiz/aim action. DB games are locked with
 * `SELECT ... FOR UPDATE`; memory games use the per-game promise queue. The
 * response is the actor's allowlisted snapshot; Socket.IO only announces that
 * a snapshot changed, it never carries a result.
 */

const { normalizeActionEnvelope } = require('../../../gameEngine/actionProtocol');
const { processCompetitiveAction, resolveActorKey } = require('../../../gameEngine/engineActions');
const { defaultRegistry } = require('../../../gameEngine/gameLock');
const { sanitizeEngineState, serializeGameForActor } = require('../../../gameEngine/gameView');
const { finalizeMemoryEngineGame, settleDbEngineGame } = require('../../../gameEngine/settlement');

const ENGINE_GAME_SELECT = `
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

const createGameActionHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    getMemoryGames,
    getMemoryUsers,
    emitRealtimeUpdate,
    gameLock = defaultRegistry,
  } = deps;

  const announce = (gameId, status, state, winner) => {
    emitRealtimeUpdate(gameId, {
      type: 'game_state_updated',
      gameId,
      status,
      revision: state.revision,
      phase: state.phase,
      winner: winner || null,
      // Verified, allowlisted snapshot. A client with a newer revision ignores
      // it; a client with a gap refetches instead of trusting peer data.
      gameState: { engine: sanitizeEngineState(state) },
      serverNow: new Date().toISOString(),
    });
  };

  const gameAction = async (req, res) => {
    // Capture trusted server time before connectivity checks, pool acquisition
    // or row/memory locks. Client timestamps are never consulted.
    const receivedAt = Date.now();
    const { id } = req.params;
    const actorName = String(req.user?.username || '').trim();
    const parsed = normalizeActionEnvelope(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.message, code: parsed.code });
    }
    if (!actorName) {
      return res.status(401).json({ error: 'Oturum gerekli.' });
    }

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(ENGINE_GAME_SELECT, [id]);
        const game = result.rows[0];
        if (!game) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }
        if (!resolveActorKey(actorName, game)) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
        }

        const processed = processCompetitiveAction({
          game,
          actorName,
          envelope: parsed.envelope,
          nowMs: receivedAt,
        });
        if (!processed.ok) {
          await client.query('ROLLBACK');
          return res.status(processed.status).json({
            error: processed.message,
            code: processed.code,
          });
        }

        let nextGameState = { ...(game.game_state || {}), engine: processed.state };
        let status = processed.status;
        let winner = processed.winner;
        const wasSettled = Boolean(game.game_state?.engine?.result?.settled);

        if (processed.state.phase === 'finished') {
          const settled = await settleDbEngineGame({
            client,
            game,
            gameState: nextGameState,
            privateState: processed.privateState,
            logger,
            nowMs: Date.now(),
          });
          if (!settled.ok) {
            await client.query('ROLLBACK');
            return res.status(409).json({
              error: 'Oyun sonucu henüz hazır değil.',
              code: settled.code || 'SERVER_RESULT_PENDING',
            });
          }
          nextGameState = settled.gameState;
          status = 'finished';
          winner = settled.winner;
        }

        if (!processed.duplicate) {
          await client.query(
            `
              UPDATE games
              SET game_state = $1::jsonb,
                  game_private_state = $2::jsonb,
                  status = $3::text,
                  winner = $4::text
              WHERE id = $5
            `,
            [
              JSON.stringify(nextGameState),
              JSON.stringify(processed.privateState),
              status,
              winner,
              id,
            ]
          );
        }
        await client.query('COMMIT');
        if (!processed.duplicate || (!wasSettled && status === 'finished')) {
          announce(id, status, nextGameState.engine, winner);
        }
        game.game_state = nextGameState;
        game.game_private_state = processed.privateState;
        game.status = status;
        game.winner = winner;

        return res.json({
          success: true,
          duplicate: Boolean(processed.duplicate),
          game: serializeGameForActor(game, actorName, receivedAt),
        });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        logger.error('Game action error', err);
        return res.status(500).json({ error: 'Oyun eylemi kaydedilemedi.' });
      } finally {
        client.release();
      }
    }

    const outcome = await gameLock.runExclusive(id, async () => {
      const game = getMemoryGames().find((item) => String(item.id) === String(id));
      if (!game) {
        return { error: { status: 404, code: 'GAME_NOT_FOUND', message: 'Oyun bulunamadı.' } };
      }
      if (!resolveActorKey(actorName, game)) {
        return {
          error: { status: 403, code: 'NOT_PARTICIPANT', message: 'Bu oyunun oyuncusu değilsin.' },
        };
      }

      const processed = processCompetitiveAction({
        game,
        actorName,
        envelope: parsed.envelope,
        nowMs: receivedAt,
      });
      if (!processed.ok) {
        return { error: processed };
      }

      const wasSettled = Boolean(game.gameState?.engine?.result?.settled);
      if (!processed.duplicate) {
        game.gameState = { ...(game.gameState || {}), engine: processed.state };
        game.gamePrivateState = processed.privateState;
        game.status = processed.status;
        game.winner = processed.winner;
      }

      let finalized = { settled: false, cancelled: false };
      if (processed.state.phase === 'finished') {
        finalized = finalizeMemoryEngineGame({
          game,
          privateState: game.gamePrivateState,
          getMemoryUsers,
          nowMs: Date.now(),
        });
      }

      if (!processed.duplicate || (!wasSettled && finalized.settled)) {
        announce(game.id, game.status, game.gameState.engine, game.winner);
      }

      return {
        duplicate: Boolean(processed.duplicate),
        game: serializeGameForActor(game, actorName, receivedAt),
      };
    });

    if (outcome.error) {
      return res.status(outcome.error.status).json({
        error: outcome.error.message,
        code: outcome.error.code,
      });
    }
    return res.json({ success: true, duplicate: outcome.duplicate, game: outcome.game });
  };

  return gameAction;
};

module.exports = { createGameActionHandler };
