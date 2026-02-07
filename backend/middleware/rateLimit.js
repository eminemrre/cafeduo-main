const redis = require('../config/redis');
const logger = require('../utils/logger');

const parseBooleanEnv = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const getStoreMode = () => String(process.env.RATE_LIMIT_STORE || 'redis').trim().toLowerCase();

const getPassOnStoreError = () => parseBooleanEnv(process.env.RATE_LIMIT_PASS_ON_STORE_ERROR, true);

const getPrefixBase = () =>
  (String(process.env.RATE_LIMIT_REDIS_PREFIX || 'cafeduo:ratelimit').trim() || 'cafeduo:ratelimit');

const INCREMENT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

const DECREMENT_SCRIPT = `
local current = redis.call("DECR", KEYS[1])
if current <= 0 then
  redis.call("DEL", KEYS[1])
end
return current
`;

class RedisRateLimitStore {
  constructor({ redisClient, windowMs, prefix }) {
    this.redis = redisClient;
    this.windowMs = windowMs;
    this.prefix = prefix;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = Number(options.windowMs || this.windowMs || 60_000);
  }

  buildKey(key) {
    return `${this.prefix}:${key}`;
  }

  resolveResetTime(ttlMs) {
    const ttl = Number(ttlMs);
    const effectiveTtl = Number.isFinite(ttl) && ttl > 0 ? ttl : this.windowMs;
    return new Date(Date.now() + effectiveTtl);
  }

  async increment(key) {
    const storeKey = this.buildKey(key);
    const [totalHitsRaw, ttlRaw] = await this.redis.eval(
      INCREMENT_SCRIPT,
      1,
      storeKey,
      this.windowMs
    );

    return {
      totalHits: Number(totalHitsRaw || 0),
      resetTime: this.resolveResetTime(ttlRaw),
    };
  }

  async get(key) {
    const storeKey = this.buildKey(key);
    const results = await this.redis.multi().get(storeKey).pttl(storeKey).exec();
    const [[getError, hitsRaw], [ttlError, ttlRaw]] = results;

    if (getError) throw getError;
    if (ttlError) throw ttlError;
    if (hitsRaw === null) return undefined;

    return {
      totalHits: Number(hitsRaw || 0),
      resetTime: this.resolveResetTime(ttlRaw),
    };
  }

  async decrement(key) {
    const storeKey = this.buildKey(key);
    await this.redis.eval(DECREMENT_SCRIPT, 1, storeKey);
  }

  async resetKey(key) {
    const storeKey = this.buildKey(key);
    await this.redis.del(storeKey);
  }

  async resetAll() {
    let cursor = '0';
    const pattern = `${this.prefix}:*`;

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 250);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}

const createRateLimitStore = ({ scope, windowMs }) => {
  if (getStoreMode() !== 'redis') {
    return undefined;
  }

  if (!redis || typeof redis.eval !== 'function') {
    logger.warn('Redis client unavailable, falling back to in-memory rate-limit store.', { scope });
    return undefined;
  }

  if (redis.status !== 'ready') {
    logger.warn('Redis client is not ready, using in-memory rate-limit store.', {
      scope,
      redisStatus: redis.status,
    });
    return undefined;
  }

  return new RedisRateLimitStore({
    redisClient: redis,
    windowMs,
    prefix: `${getPrefixBase()}:${scope}`,
  });
};

const buildRateLimiterOptions = ({ scope, windowMs, limit, ...restOptions }) => {
  const options = {
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: getPassOnStoreError(),
    ...restOptions,
  };

  const store = createRateLimitStore({ scope, windowMs });
  if (store) {
    options.store = store;
  }

  return options;
};

module.exports = {
  RedisRateLimitStore,
  buildRateLimiterOptions,
  createRateLimitStore,
  parseBooleanEnv,
  getPassOnStoreError,
};
