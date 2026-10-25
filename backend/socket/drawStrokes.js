/**
 * `draw_strokes`: the one gameplay event a client may send over Socket.IO.
 *
 * Accepted only from the current drawer of an open Çiz Bil drawing, after the
 * packet has been reduced to known fields (see gameEngine/drawStrokes.js) and
 * within a 30 packets/s budget. Strokes never touch scores, words or clocks,
 * which stay on the authenticated HTTP action path. Accepted packets are
 * stored for replay and relayed to the rest of the game room.
 */

const { validateStrokePacket } = require('../gameEngine/drawStrokes');

const sameName = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase() && Boolean(String(a || '').trim());

/** Caches `loadTurn(gameId)` → `{ roundId, drawerName, open }` for `ttlMs`. */
const createTurnCache = ({ loadTurn, ttlMs = 1000, now = Date.now, maxEntries = 500 }) => {
  const cache = new Map();
  return {
    async get(gameId, { fresh = false } = {}) {
      const hit = cache.get(gameId);
      if (!fresh && hit && now() - hit.at < ttlMs) return hit.turn;
      const turn = await loadTurn(gameId);
      if (cache.size >= maxEntries) cache.delete(cache.keys().next().value);
      cache.set(gameId, { turn, at: now() });
      return turn;
    },
  };
};

const createDrawStrokeHandler = ({ socket, turns, store, limiter, logger }) => {
  const refuse = (code) => socket.emit('draw_rejected', { code });

  return async (payload) => {
    if (!limiter.take(socket.id)) return;
    const packet = validateStrokePacket(payload);
    if (!packet.ok) {
      refuse(packet.code);
      return;
    }
    const { gameId, roundId, ops, points } = packet;
    if (!socket.rooms || !socket.rooms.has(gameId)) {
      refuse('NOT_IN_ROOM');
      return;
    }
    const allowed = (turn) =>
      Boolean(turn) && turn.open && turn.roundId === roundId && sameName(turn.drawerName, socket.username);
    try {
      let turn = await turns.get(gameId);
      // The cache may predate the pick or the next round; check once more.
      if (!allowed(turn)) turn = await turns.get(gameId, { fresh: true });
      if (!allowed(turn)) {
        refuse('NOT_DRAWING');
        return;
      }
      const stored = await store.append(gameId, roundId, ops, points);
      if (!stored.ok) {
        refuse(stored.code);
        return;
      }
      socket.to(gameId).emit('draw_strokes', { gameId, roundId, ops });
    } catch (error) {
      logger.warn('draw_strokes failed', { gameId, error: error?.message });
      refuse('STROKES_FAILED');
    }
  };
};

module.exports = { createDrawStrokeHandler, createTurnCache };
