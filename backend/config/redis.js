const Redis = require('ioredis');
const dotenv = require('dotenv');
const logger = require('../utils/logger'); // CommonJS import

dotenv.config();

const redisUrl = String(process.env.REDIS_URL || '').trim();
const createRedisClient = () => {
    if (!redisUrl) {
        logger.warn('Redis disabled: REDIS_URL is not configured. Falling back to in-memory mode.');
        return null;
    }

    const client = new Redis(redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        connectTimeout: 1000,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
            const delay = Math.min(times * 100, 1000);
            return delay;
        },
    });

    client.on('connect', () => {
        logger.info('✅ Redis connected successfully');
    });

    client.on('error', (err) => {
        logger.error(`❌ Redis connection error: ${err.message}`);
    });

    client.connect().catch((err) => {
        logger.warn(`⚠️ Redis initial connection failed, continuing without Redis-first guarantees: ${err.message}`);
    });

    return client;
};

module.exports = createRedisClient();
