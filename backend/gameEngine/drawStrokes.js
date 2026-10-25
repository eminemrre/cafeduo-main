/**
 * Çiz Bil stroke channel: packet validation, the per-round stroke store and a
 * per-socket rate limiter.
 *
 * Strokes are the one player input that travels over Socket.IO (approved
 * 2026-10-24): they never change a score, a word or a clock, which stay on the
 * authenticated HTTP action path. The socket handler accepts a packet only
 * from the current drawer of an open drawing (see backend/socket/drawStrokes.js),
 * stores it here and relays it to the room; a reloading player replays the
 * round through `GET /api/games/:id/strokes`.
 *
 * Canvas coordinates are integers 0..1000 on both axes; colours and widths are
 * palette indexes, so a packet cannot carry text or markup.
 */

const CANVAS_MAX = 1000;
const MAX_OPS_PER_PACKET = 8;
const MAX_POINTS_PER_PACKET = 128;
const MAX_POINTS_PER_ROUND = 6000;
/** A clear has no points but costs budget, so clears cannot flood a round (≤ 240). */
const CLEAR_COST = 25;
/** Rounds the memory fallback keeps at once; beyond that new rounds are refused. */
const MAX_MEMORY_ROUNDS = 500;
const MEMORY_PRUNE_MS = 1000;
const MAX_STROKE_ID = 9999;
const COLOR_COUNT = 8;
const WIDTH_COUNT = 3;
const STROKE_TTL_SECONDS = 60 * 60;
const ROUND_ID_PATTERN = /^r\d{1,3}$/;
const GAME_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

const invalid = { ok: false, code: 'INVALID_STROKES' };
const isIndex = (value, count) => Number.isInteger(value) && value >= 0 && value < count;
const isCoord = (value) => Number.isInteger(value) && value >= 0 && value <= CANVAS_MAX;

/** Returns `{ ok, gameId, roundId, ops, points }` with only known fields, or INVALID_STROKES. */
const validateStrokePacket = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return invalid;
  const gameId = String(payload.gameId ?? '').trim();
  const roundId = String(payload.roundId ?? '').trim();
  if (!GAME_ID_PATTERN.test(gameId) || !ROUND_ID_PATTERN.test(roundId)) return invalid;
  const source = payload.ops;
  if (!Array.isArray(source) || source.length === 0 || source.length > MAX_OPS_PER_PACKET) return invalid;
  const ops = [];
  /** Budget the packet costs: its points plus CLEAR_COST per clear. */
  let points = 0;
  let lineLength = 0;
  for (const op of source) {
    if (!op || typeof op !== 'object') return invalid;
    if (op.t === 'clear') {
      ops.push({ t: 'clear' });
      points += CLEAR_COST;
      continue;
    }
    if (op.t !== 'line') return invalid;
    if (!isIndex(op.id, MAX_STROKE_ID + 1) || !isIndex(op.c, COLOR_COUNT) || !isIndex(op.w, WIDTH_COUNT)) {
      return invalid;
    }
    if (!Array.isArray(op.p) || op.p.length === 0) return invalid;
    lineLength += op.p.length;
    if (lineLength > MAX_POINTS_PER_PACKET) return invalid;
    points += op.p.length;
    const p = [];
    for (const point of op.p) {
      if (!Array.isArray(point) || point.length !== 2 || !isCoord(point[0]) || !isCoord(point[1])) return invalid;
      p.push([point[0], point[1]]);
    }
    ops.push({ t: 'line', id: op.id, c: op.c, w: op.w, p });
  }
  return { ok: true, gameId, roundId, ops, points };
};

/**
 * Per-round packet list. Redis (`cafeduo:draw:{gameId}:{roundId}`, one JSON
 * packet per entry, 1 h TTL) when it is ready, memory otherwise.
 */
const createStrokeStore = ({ redis = null, now = Date.now, logger = null } = {}) => {
  const memory = new Map();
  let prunedAt = -Infinity;
  const keyOf = (gameId, roundId) => `cafeduo:draw:${gameId}:${roundId}`;
  const redisReady = () => Boolean(redis) && redis.status === 'ready';

  const memoryEntry = (key) => {
    const entry = memory.get(key);
    if (entry && entry.expiresAt <= now()) {
      memory.delete(key);
      return null;
    }
    return entry || null;
  };
  const pruneMemory = () => {
    const at = now();
    if (at - prunedAt < MEMORY_PRUNE_MS) return;
    prunedAt = at;
    for (const [key, entry] of memory) if (entry.expiresAt <= at) memory.delete(key);
  };

  const appendMemory = (key, ops, points) => {
    pruneMemory();
    const existing = memoryEntry(key);
    if (!existing && memory.size >= MAX_MEMORY_ROUNDS) return { ok: false, code: 'STORE_FULL' };
    const entry = existing || { packets: [], points: 0, expiresAt: 0 };
    if (entry.points + points > MAX_POINTS_PER_ROUND) return { ok: false, code: 'ROUND_FULL' };
    entry.points += points;
    entry.packets.push(ops);
    entry.expiresAt = now() + STROKE_TTL_SECONDS * 1000;
    memory.set(key, entry);
    return { ok: true };
  };

  const append = async (gameId, roundId, ops, points) => {
    const key = keyOf(gameId, roundId);
    if (redisReady()) {
      // The budget is reserved atomically first; the packet and both TTLs are
      // then written in one MULTI. A failed write gives the budget back and
      // fails the packet rather than splitting a round between Redis and memory.
      const counterKey = `${key}:points`;
      let reserved = false;
      try {
        const total = await redis.incrby(counterKey, points);
        reserved = true;
        if (total > MAX_POINTS_PER_ROUND) {
          await redis.decrby(counterKey, points);
          return { ok: false, code: 'ROUND_FULL' };
        }
        const results = await redis
          .multi()
          .rpush(key, JSON.stringify(ops))
          .expire(key, STROKE_TTL_SECONDS)
          .expire(counterKey, STROKE_TTL_SECONDS)
          .exec();
        if (!Array.isArray(results) || results.some((entry) => entry && entry[0])) {
          throw new Error('stroke write failed');
        }
        return { ok: true };
      } catch (error) {
        logger?.warn?.('Stroke write failed', { error: error?.message });
        if (reserved) await Promise.resolve(redis.decrby(counterKey, points)).catch(() => {});
        return { ok: false, code: 'STROKES_FAILED' };
      }
    }
    return appendMemory(key, ops, points);
  };

  const list = async (gameId, roundId) => {
    const key = keyOf(gameId, roundId);
    if (redisReady()) {
      try {
        const rows = await redis.lrange(key, 0, -1);
        if (rows.length) return rows.flatMap((row) => JSON.parse(row));
      } catch (error) {
        logger?.warn?.('Stroke store read fell back to memory', { error: error?.message });
      }
    }
    const entry = memoryEntry(key);
    return entry ? entry.packets.flat() : [];
  };

  return { append, list };
};

/** Token bucket per key (a user); idle full buckets are dropped past `maxKeys`. */
const createRateLimiter = ({ perSecond = 30, burst = perSecond, now = Date.now, maxKeys = 5000 } = {}) => {
  const buckets = new Map();
  const refillMs = (burst / perSecond) * 1000;
  return {
    take(key) {
      const at = now();
      if (buckets.size >= maxKeys && !buckets.has(key)) {
        for (const [other, bucket] of buckets) if (at - bucket.at >= refillMs) buckets.delete(other);
        if (buckets.size >= maxKeys) return false;
      }
      const bucket = buckets.get(key) || { tokens: burst, at };
      bucket.tokens = Math.min(burst, bucket.tokens + ((at - bucket.at) * perSecond) / 1000);
      bucket.at = at;
      const allowed = bucket.tokens >= 1;
      if (allowed) bucket.tokens -= 1;
      buckets.set(key, bucket);
      return allowed;
    },
    forget(key) {
      buckets.delete(key);
    },
  };
};

module.exports = {
  CANVAS_MAX,
  CLEAR_COST,
  MAX_MEMORY_ROUNDS,
  COLOR_COUNT,
  MAX_OPS_PER_PACKET,
  MAX_POINTS_PER_PACKET,
  MAX_POINTS_PER_ROUND,
  WIDTH_COUNT,
  createRateLimiter,
  createStrokeStore,
  validateStrokePacket,
};
