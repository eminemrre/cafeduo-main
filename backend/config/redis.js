const Redis = require('ioredis');
const dotenv = require('dotenv');
const logger = require('../utils/logger'); // CommonJS import

dotenv.config();

const redisUrl = process.env.***REMOVED*** || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3
});

redis.on('connect', () => {
    logger.info('✅ Redis connected successfully');
});

redis.on('error', (err) => {
    logger.error(`❌ Redis connection error: ${err.message}`);
});

module.exports = redis;
