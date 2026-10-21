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
const { serializeGameForActor } = require('../../../gameEngine/gameView');

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
    created_at
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
    });
  };

  const gameAction = async (req, res) => {
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
          nowMs: Date.now(),
        });
        if (!processed.ok) {
          await client.query('ROLLBACK');
          return res.status(processed.status).json({
            error: processed.message,
            code: processed.code,
          });
        }

        if (!processed.duplicate) {
          const nextGameState = { ...(game.game_state || {}), engine: processed.state };
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
              processed.status,
              processed.winner,
              id,
            ]
          );
          await client.query('COMMIT');
          announce(id, processed.status, processed.state, processed.winner);
          game.game_state = nextGameState;
        } else {
          await client.query('COMMIT');
        }

        return res.json({
          success: true,
          duplicate: Boolean(processed.duplicate),
          game: serializeGameForActor({
            ...game,
            game_state: game.game_state,
            status: processed.status,
            winner: processed.winner,
          }),
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
        nowMs: Date.now(),
      });
      if (!processed.ok) {
        return { error: processed };
      }

      if (!processed.duplicate) {
        game.gameState = { ...(game.gameState || {}), engine: processed.state };
        game.gamePrivateState = processed.privateState;
        game.status = processed.status;
        game.winner = processed.winner;
        announce(game.id, processed.status, processed.state, processed.winner);
      }

      return {
        duplicate: Boolean(processed.duplicate),
        game: serializeGameForActor(game),
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
