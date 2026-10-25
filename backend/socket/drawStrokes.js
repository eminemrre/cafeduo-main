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

/**
 * Caches `loadTurn(gameId)` → `{ roundId, drawerName, open }` for `ttlMs`.
 * A `fresh` read reloads at most once per `minFreshMs` per game, and
 * concurrent reloads of one game share a single query.
 */
const createTurnCache = ({ loadTurn, ttlMs = 1000, minFreshMs = 250, now = Date.now, maxEntries = 500 }) => {
  const cache = new Map();
  const inFlight = new Map();
  const load = (gameId) => {
    if (inFlight.has(gameId)) return inFlight.get(gameId);
    const pending = Promise.resolve(loadTurn(gameId))
      .then((turn) => {
        if (cache.size >= maxEntries && !cache.has(gameId)) cache.delete(cache.keys().next().value);
        cache.set(gameId, { turn, at: now() });
        return turn;
      })
      .finally(() => inFlight.delete(gameId));
    inFlight.set(gameId, pending);
    return pending;
  };
  return {
    async get(gameId, { fresh = false } = {}) {
      const hit = cache.get(gameId);
      const age = hit ? now() - hit.at : Infinity;
      if (hit && (fresh ? age < minFreshMs : age < ttlMs)) return hit.turn;
      return load(gameId);
    },
  };
};

const AUTH_RECHECK_MS = 60_000;

const createDrawStrokeHandler = ({ socket, turns, store, limiter, logger, now = Date.now }) => {
  const refuse = (code) => socket.emit('draw_rejected', { code });
  // One budget per user, however many sockets it opens.
  const budgetKey = `user:${socket.userId ?? String(socket.username || '').toLowerCase()}`;
  let authCheckedAt = -Infinity;

  /** Expired or revoked sessions are dropped; revocation is checked once a minute. */
  const sessionValid = async () => {
    if (Number.isFinite(socket.tokenExpiresAt) && now() >= socket.tokenExpiresAt) return false;
    if (typeof socket.isSessionRevoked !== 'function' || now() - authCheckedAt < AUTH_RECHECK_MS) return true;
    const revoked = await socket.isSessionRevoked();
    authCheckedAt = now();
    return !revoked;
  };

  return async (payload) => {
    if (!limiter.take(budgetKey)) return;
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
      if (!(await sessionValid())) {
        refuse('AUTH_EXPIRED');
        socket.disconnect(true);
        return;
      }
      let turn = await turns.get(gameId);
      // The cache may predate the pick or the next round: reload (throttled)
      // for the cached drawer or another round, never for a known non-drawer.
      const cachedDrawer = Boolean(turn) && sameName(turn.drawerName, socket.username);
      if (!allowed(turn) && (!turn || turn.roundId !== roundId || cachedDrawer)) {
        turn = await turns.get(gameId, { fresh: true });
      }
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
