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
  parseBooleanEnv,
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
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RATE_LIMIT_STORE;
    delete process.env.RATE_LIMIT_REDIS_PREFIX;
    delete process.env.RATE_LIMIT_PASS_ON_STORE_ERROR;
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

    mockRedis.multi.mockReturnValueOnce(buildMulti([[null, null], [null, -2]]));
    const missing = await store.get('client-a');
    expect(missing).toBeUndefined();

    mockRedis.multi.mockReturnValueOnce(buildMulti([[null, '5'], [null, 10_000]]));
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
    expect(mockRedis.del).toHaveBeenNthCalledWith(1, 'cafeduo:ratelimit:api:a', 'cafeduo:ratelimit:api:b');
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
});
