jest.mock('../config/redis', () => ({
  status: 'ready',
  eval: jest.fn(),
  multi: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  RedisRateLimitStore,
  buildRateLimiterOptions,
  createRateLimitStore,
  parseBooleanEnv,
  getPassOnStoreError,
} = require('./rateLimit');
const mockRedis = require('../config/redis');

const buildMulti = (response) => {
  const chain = {
    get: jest.fn(() => chain),
    pttl: jest.fn(() => chain),
    exec: jest.fn().mockResolvedValue(response),
  };
  return chain;
};

describe('rateLimit middleware helpers', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    RATE_LIMIT_STORE: process.env.RATE_LIMIT_STORE,
    RATE_LIMIT_REDIS_PREFIX: process.env.RATE_LIMIT_REDIS_PREFIX,
    RATE_LIMIT_PASS_ON_STORE_ERROR: process.env.RATE_LIMIT_PASS_ON_STORE_ERROR,
  };
  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  beforeEach(() => {
    jest.resetAllMocks();
    mockRedis.status = 'ready';
    process.env.NODE_ENV = 'test';
    delete process.env.RATE_LIMIT_STORE;
    delete process.env.RATE_LIMIT_REDIS_PREFIX;
    delete process.env.RATE_LIMIT_PASS_ON_STORE_ERROR;
  });

  it.each(['connecting', 'reconnecting', 'wait', 'end'])(
    'retains the production Redis store while the client is %s',
    (status) => {
      process.env.NODE_ENV = 'production';
      mockRedis.status = status;
      const options = buildRateLimiterOptions({ scope: 'api', windowMs: 60_000, limit: 10 });
      expect(options.store).toBeInstanceOf(RedisRateLimitStore);
      expect(options.store.redis).toBe(mockRedis);
      expect(options.passOnStoreError).toBe(false);
    }
  );

  it('refuses production Redis mode when the client is unavailable', () => {
    process.env.NODE_ENV = 'production';
    const evalMethod = mockRedis.eval;
    mockRedis.eval = undefined;
    try {
      expect(() => createRateLimitStore({ scope: 'api', windowMs: 60_000 })).toThrow(
        'Redis rate limiting requires a configured Redis client in production.'
      );
    } finally {
      mockRedis.eval = evalMethod;
    }
  });

  it('preserves development memory fallback while Redis is not ready', () => {
    mockRedis.status = 'connecting';
    expect(createRateLimitStore({ scope: 'api', windowMs: 60_000 })).toBeUndefined();
  });

  it('rejects unavailable Redis immediately and resumes with the same store when ready', async () => {
    const store = new RedisRateLimitStore({
      redisClient: mockRedis,
      windowMs: 60_000,
      prefix: 'test',
    });
    mockRedis.status = 'reconnecting';
    await expect(store.increment('client')).rejects.toMatchObject({
      status: 503,
      code: 'RATE_LIMIT_STORE_UNAVAILABLE',
    });
    expect(mockRedis.eval).not.toHaveBeenCalled();
    mockRedis.status = 'ready';
    mockRedis.eval.mockResolvedValueOnce([2, 60_000]);
    await expect(store.increment('client')).resolves.toMatchObject({ totalHits: 2 });
  });

  it('parses boolean environment values safely', () => {
    expect(parseBooleanEnv('true', false)).toBe(true);
    expect(parseBooleanEnv('0', true)).toBe(false);
    expect(parseBooleanEnv('invalid-value', true)).toBe(true);
    expect(parseBooleanEnv(undefined, false)).toBe(false);
  });

  it('increments redis-backed counters and returns reset time', async () => {
    const store = new RedisRateLimitStore({
      redisClient: mockRedis,
      windowMs: 120_000,
      prefix: 'cafeduo:ratelimit:api',
    });
    mockRedis.eval.mockResolvedValueOnce([3, 120_000]);

    const result = await store.increment('127.0.0.1');

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining('INCR'),
      1,
      'cafeduo:ratelimit:api:127.0.0.1',
      120_000
    );
    expect(result.totalHits).toBe(3);
    expect(result.resetTime).toBeInstanceOf(Date);
  });

  it('reads existing counters from redis and handles empty keys', async () => {
    const store = new RedisRateLimitStore({
      redisClient: mockRedis,
      windowMs: 60_000,
      prefix: 'cafeduo:ratelimit:auth',
    });

    mockRedis.multi.mockReturnValueOnce(
      buildMulti([
        [null, null],
        [null, -2],
      ])
    );
    const missing = await store.get('client-a');
    expect(missing).toBeUndefined();

    mockRedis.multi.mockReturnValueOnce(
      buildMulti([
        [null, '5'],
        [null, 10_000],
      ])
    );
    const existing = await store.get('client-b');
    expect(existing).toEqual(
      expect.objectContaining({
        totalHits: 5,
        resetTime: expect.any(Date),
      })
    );
  });

  it('resets all scoped keys via scan + del', async () => {
    const store = new RedisRateLimitStore({
      redisClient: mockRedis,
      windowMs: 60_000,
      prefix: 'cafeduo:ratelimit:api',
    });

    mockRedis.scan
      .mockResolvedValueOnce(['1', ['cafeduo:ratelimit:api:a', 'cafeduo:ratelimit:api:b']])
      .mockResolvedValueOnce(['0', ['cafeduo:ratelimit:api:c']]);
    mockRedis.del.mockResolvedValue(3);

    await store.resetAll();

    expect(mockRedis.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'cafeduo:ratelimit:api:*',
      'COUNT',
      250
    );
    expect(mockRedis.del).toHaveBeenNthCalledWith(
      1,
      'cafeduo:ratelimit:api:a',
      'cafeduo:ratelimit:api:b'
    );
    expect(mockRedis.del).toHaveBeenNthCalledWith(2, 'cafeduo:ratelimit:api:c');
  });

  it('builds in-memory options when redis store is disabled', () => {
    process.env.RATE_LIMIT_STORE = 'memory';
    process.env.RATE_LIMIT_PASS_ON_STORE_ERROR = 'false';

    const options = buildRateLimiterOptions({
      scope: 'api',
      windowMs: 60_000,
      limit: 100,
    });

    expect(options.store).toBeUndefined();
    expect(options.passOnStoreError).toBe(false);
    expect(options.limit).toBe(100);
  });

  it('builds redis-backed options with scoped prefix', () => {
    process.env.RATE_LIMIT_STORE = 'redis';
    process.env.RATE_LIMIT_REDIS_PREFIX = 'cafeduo:rl';

    const options = buildRateLimiterOptions({
      scope: 'auth:login',
      windowMs: 60_000,
      limit: 20,
    });

    expect(options.store).toBeInstanceOf(RedisRateLimitStore);
    expect(options.store.prefix).toBe('cafeduo:rl:auth:login');
    expect(options.passOnStoreError).toBe(true);
  });

  it('defaults to fail-closed on store errors in production when env is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RATE_LIMIT_PASS_ON_STORE_ERROR;

    expect(getPassOnStoreError()).toBe(false);

    const options = buildRateLimiterOptions({
      scope: 'api',
      windowMs: 60_000,
      limit: 10,
    });

    expect(options.passOnStoreError).toBe(false);
  });
});
