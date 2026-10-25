/** @jest-environment node */
const {
  MAX_POINTS_PER_PACKET,
  MAX_POINTS_PER_ROUND,
  createRateLimiter,
  createStrokeStore,
  validateStrokePacket,
} = require('./drawStrokes');

const line = (id, points, extra = {}) => ({ t: 'line', id, c: 0, w: 1, p: points, ...extra });
const pts = (n) => Array.from({ length: n }, (_, i) => [i, 1000 - i]);

describe('validateStrokePacket', () => {
  it('accepts lines and clears and keeps only the known fields', () => {
    const result = validateStrokePacket({
      gameId: '77',
      roundId: 'r2',
      ops: [line(3, [[0, 0], [1000, 1000]], { evil: '<script>' }), { t: 'clear', extra: 1 }],
      extra: true,
    });
    expect(result).toEqual({
      ok: true,
      gameId: '77',
      roundId: 'r2',
      points: 2,
      ops: [{ t: 'line', id: 3, c: 0, w: 1, p: [[0, 0], [1000, 1000]] }, { t: 'clear' }],
    });
  });

  it.each([
    ['no game', { roundId: 'r1', ops: [line(1, [[0, 0]])] }],
    ['bad round', { gameId: '1', roundId: 'x', ops: [line(1, [[0, 0]])] }],
    ['no ops', { gameId: '1', roundId: 'r1', ops: [] }],
    ['too many ops', { gameId: '1', roundId: 'r1', ops: Array.from({ length: 9 }, () => ({ t: 'clear' })) }],
    ['unknown op', { gameId: '1', roundId: 'r1', ops: [{ t: 'text', s: 'kedi' }] }],
    ['off canvas', { gameId: '1', roundId: 'r1', ops: [line(1, [[0, 1001]])] }],
    ['fractions', { gameId: '1', roundId: 'r1', ops: [line(1, [[0.5, 1]])] }],
    ['bad colour', { gameId: '1', roundId: 'r1', ops: [line(1, [[0, 0]], { c: 8 })] }],
    ['bad width', { gameId: '1', roundId: 'r1', ops: [line(1, [[0, 0]], { w: 3 })] }],
    ['bad id', { gameId: '1', roundId: 'r1', ops: [line(-1, [[0, 0]])] }],
    ['empty line', { gameId: '1', roundId: 'r1', ops: [line(1, [])] }],
    ['too many points', { gameId: '1', roundId: 'r1', ops: [line(1, pts(MAX_POINTS_PER_PACKET + 1))] }],
    ['not an object', 'kedi'],
  ])('refuses %s', (_label, payload) => {
    expect(validateStrokePacket(payload)).toMatchObject({ ok: false, code: 'INVALID_STROKES' });
  });
});

describe('createStrokeStore (memory)', () => {
  it('appends packets in order per round and caps the points of a round', async () => {
    let now = 0;
    const store = createStrokeStore({ redis: null, now: () => now });
    expect(await store.append('7', 'r1', [line(1, pts(3))], 3)).toEqual({ ok: true });
    expect(await store.append('7', 'r1', [{ t: 'clear' }], 0)).toEqual({ ok: true });
    expect(await store.append('7', 'r2', [line(2, pts(1))], 1)).toEqual({ ok: true });
    expect(await store.list('7', 'r1')).toEqual([line(1, pts(3)), { t: 'clear' }]);
    expect(await store.list('7', 'r2')).toEqual([line(2, pts(1))]);
    expect(await store.list('8', 'r1')).toEqual([]);

    const big = Math.floor(MAX_POINTS_PER_ROUND / 2);
    expect(await store.append('9', 'r1', [line(1, pts(1))], big)).toEqual({ ok: true });
    expect(await store.append('9', 'r1', [line(1, pts(1))], big)).toEqual({ ok: true });
    expect(await store.append('9', 'r1', [line(1, pts(1))], big)).toEqual({ ok: false, code: 'ROUND_FULL' });

    now = 2 * 60 * 60 * 1000;
    expect(await store.list('7', 'r1')).toEqual([]);
  });
});

describe('createStrokeStore (redis)', () => {
  const fakeRedis = () => {
    const lists = new Map();
    const counters = new Map();
    const multi = () => {
      const steps = [];
      const chain = {
        incrby: (key, by) => (steps.push(() => counters.set(key, (counters.get(key) || 0) + by) && counters.get(key)), chain),
        rpush: (key, value) => (steps.push(() => lists.set(key, [...(lists.get(key) || []), value]).get(key).length), chain),
        expire: () => (steps.push(() => 1), chain),
        exec: async () => steps.map((step) => [null, step()]),
      };
      return chain;
    };
    return {
      status: 'ready',
      lists,
      multi,
      incrby: async (key, by) => {
        counters.set(key, (counters.get(key) || 0) + by);
        return counters.get(key);
      },
      decrby: async (key, by) => {
        counters.set(key, (counters.get(key) || 0) - by);
        return counters.get(key);
      },
      expire: async () => 1,
      rpush: async (key, value) => lists.set(key, [...(lists.get(key) || []), value]).get(key).length,
      lrange: async (key) => lists.get(key) || [],
    };
  };

  it('stores packets as JSON lists with a TTL and enforces the same cap', async () => {
    const redis = fakeRedis();
    const store = createStrokeStore({ redis });
    expect(await store.append('7', 'r1', [line(1, pts(2))], 2)).toEqual({ ok: true });
    expect(await store.list('7', 'r1')).toEqual([line(1, pts(2))]);
    expect([...redis.lists.keys()]).toEqual(['cafeduo:draw:7:r1']);
    expect(await store.append('7', 'r1', [line(1, pts(1))], MAX_POINTS_PER_ROUND)).toEqual({
      ok: false,
      code: 'ROUND_FULL',
    });
    expect(await store.list('7', 'r1')).toHaveLength(1);
  });

  it('falls back to memory when Redis is not ready', async () => {
    const redis = { ...fakeRedis(), status: 'reconnecting' };
    const store = createStrokeStore({ redis });
    await store.append('7', 'r1', [line(1, pts(1))], 1);
    expect(redis.lists.size).toBe(0);
    expect(await store.list('7', 'r1')).toEqual([line(1, pts(1))]);
  });
});

describe('createRateLimiter', () => {
  it('allows a burst of 30 packets and refills at 30 per second', () => {
    let now = 0;
    const limiter = createRateLimiter({ perSecond: 30, now: () => now });
    for (let i = 0; i < 30; i += 1) expect(limiter.take('s1')).toBe(true);
    expect(limiter.take('s1')).toBe(false);
    expect(limiter.take('s2')).toBe(true);
    now = 100;
    expect(limiter.take('s1')).toBe(true);
    expect(limiter.take('s1')).toBe(true);
    expect(limiter.take('s1')).toBe(true);
    expect(limiter.take('s1')).toBe(false);
    limiter.forget('s1');
    expect(limiter.take('s1')).toBe(true);
  });
});
