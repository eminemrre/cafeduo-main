/**
 * GET /api/games/:id/strokes — replays the current Çiz Bil round's strokes to
 * a player who joined late, reloaded or reconnected. Participants only; reads
 * the public engine state, never the private one.
 */

const { DRAW_GAME_TYPE } = require('../../../../shared/gameRegistry');
const { isAdminActor } = require('../validation');

const REPLAY_PHASES = new Set(['drawing', 'reveal']);
const sameName = (a, b) =>
  Boolean(String(a || '').trim()) &&
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

const createDrawStrokesHandler = ({ pool, isDbConnected, getMemoryGames, strokeStore, logger }) => {
  const loadGame = async (id) => {
    if (await isDbConnected()) {
      if (!/^\d+$/.test(id)) return null;
      const result = await pool.query(
        `SELECT host_name AS "hostName", guest_name AS "guestName", game_type AS "gameType",
                game_state->'engine' AS engine
         FROM games
         WHERE id = $1
         LIMIT 1`,
        [id]
      );
      return result.rows[0] || null;
    }
    const game = getMemoryGames().find((entry) => String(entry.id) === id);
    return game
      ? {
          hostName: game.hostName ?? game.host_name,
          guestName: game.guestName ?? game.guest_name,
          gameType: game.gameType ?? game.game_type,
          engine: (game.gameState ?? game.game_state)?.engine || null,
        }
      : null;
  };

  return async (req, res) => {
    const id = String(req.params?.id || '').trim();
    const actor = req.user?.username;
    try {
      const game = await loadGame(id);
      if (!game) return res.status(404).json({ error: 'Oyun bulunamadı.' });
      if (!isAdminActor(req.user) && !sameName(actor, game.hostName) && !sameName(actor, game.guestName)) {
        return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
      }
      if (String(game.gameType || '').trim() !== DRAW_GAME_TYPE) {
        return res.status(400).json({ error: 'Bu oyunda çizim yok.', code: 'NOT_A_DRAW_GAME' });
      }
      const round = game.engine?.round;
      const roundId = typeof round?.id === 'string' ? round.id : null;
      if (!roundId || !REPLAY_PHASES.has(game.engine.phase)) return res.json({ roundId, ops: [] });
      const ops = await strokeStore.list(id, roundId);
      return res.json({ roundId, ops });
    } catch (error) {
      logger.error('Draw strokes replay failed', { gameId: id, error: error?.message });
      return res.status(500).json({ error: 'Çizim yüklenemedi.' });
    }
  };
};

module.exports = { createDrawStrokesHandler };
