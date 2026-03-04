/** @jest-environment node */

describe('backend/config/redis', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  const loadRedisConfig = ({ redisUrl, connectError = null } = {}) => {
    jest.resetModules();

    if (typeof redisUrl === 'string') {
      process.env.REDIS_URL = redisUrl;
    } else {
      delete process.env.REDIS_URL;
    }

    const connect = connectError
      ? jest.fn().mockRejectedValue(connectError)
      : jest.fn().mockResolvedValue(undefined);
    const on = jest.fn();
    const RedisCtor = jest.fn(() => ({ on, connect }));
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    jest.doMock('ioredis', () => RedisCtor);
    jest.doMock('../utils/logger', () => logger);

    const redis = require('./redis');
    return { redis, RedisCtor, logger, connect, on };
  };

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.dontMock('dotenv');
    jest.dontMock('ioredis');
    jest.dontMock('../utils/logger');
  });

  afterAll(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('exports null and warns when REDIS_URL is missing', () => {
    const { redis, RedisCtor, logger } = loadRedisConfig();

    expect(redis).toBeNull();
    expect(RedisCtor).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('REDIS_URL is not configured')
    );
  });

  it('creates redis client with resilient defaults when REDIS_URL exists', () => {
    const { redis, RedisCtor, connect, on } = loadRedisConfig({
      redisUrl: 'redis://127.0.0.1:6379',
    });

    expect(redis).toBeTruthy();
    expect(RedisCtor).toHaveBeenCalledWith(
      'redis://127.0.0.1:6379',
      expect.objectContaining({
        lazyConnect: true,
        enableOfflineQueue: false,
        connectTimeout: 1000,
        maxRetriesPerRequest: 1,
      })
    );
    expect(on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('logs warning when initial connect fails', async () => {
    const { logger } = loadRedisConfig({
      redisUrl: 'redis://127.0.0.1:6379',
      connectError: new Error('connect-failed'),
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Redis initial connection failed')
    );
  });
});
