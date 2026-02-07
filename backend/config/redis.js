const Redis = require('ioredis');
const dotenv = require('dotenv');
const logger = require('../utils/logger'); // CommonJS import

dotenv.config();

const redisUrl = String(process.env.***REMOVED*** || '').trim();

if (!redisUrl) {
    logger.warn('Redis disabled: ***REMOVED*** is not configured. Falling back to in-memory mode.');
    module.exports = null;
    return;
}

const redis = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 1000,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
        const delay = Math.min(times * 100, 1000);
        return delay;
    },
});

redis.on('connect', () => {
    logger.info('✅ Redis connected successfully');
});

redis.on('error', (err) => {
    logger.error(`❌ Redis connection error: ${err.message}`);
});

redis.connect().catch((err) => {
    logger.warn(`⚠️ Redis initial connection failed, continuing without Redis-first guarantees: ${err.message}`);
});

module.exports = redis;
