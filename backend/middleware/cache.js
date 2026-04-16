const redis = require('../config/redis');
const logger = require('../utils/logger');

const hasRedisClient = Boolean(
    redis &&
    typeof redis.get === 'function' &&
    typeof redis.setex === 'function' &&
    typeof redis.scan === 'function' &&
    typeof redis.del === 'function'
);

/**
 * Redis Caching Middleware
 * @param {number} duration - Cache duration in seconds
 */
const cache = (duration = 300) => {
    return async (req, res, next) => {
        // Skip caching for non-GET requests
        if (req.method !== 'GET' || !hasRedisClient) {
            return next();
        }

        const key = `cache:${req.originalUrl || req.url}`;

        try {
            const cachedData = await redis.get(key);

            if (cachedData) {
                logger.debug(`🚀 Cache hit: ${key}`);
                return res.json(JSON.parse(cachedData));
            }

            // Intercept res.json to cache the response
            const originalJson = res.json;
            res.json = (body) => {
                // Cache only successful responses (200-299)
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redis.setex(key, duration, JSON.stringify(body))
                        .catch(err => logger.error(`Redis set error: ${err.message}`));
                }
                res.originalJson = originalJson; // Restore just in case
                return originalJson.call(res, body);
            };

            next();
        } catch (err) {
            logger.error(`Redis cache error: ${err.message}`);
            next(); // Fail safe - continue without cache
        }
    };
};

/**
 * Clear cache by key pattern (non-blocking SCAN-based)
 * @param {string} pattern - Redis key pattern (e.g. "cache:/api/cafes*")
 */
const clearCache = async (pattern) => {
    if (!hasRedisClient) {
        return;
    }
    try {
        let cursor = '0';
        let totalDeleted = 0;
        const batch = [];

        do {
            const [nextCursor, keys] = await redis.scan(
                cursor,
                'MATCH', pattern,
                'COUNT', 100
            );
            cursor = nextCursor;

            if (keys.length > 0) {
                batch.push(...keys);
                if (batch.length >= 100) {
                    await redis.del(...batch);
                    totalDeleted += batch.length;
                    batch.length = 0;
                }
            }
        } while (cursor !== '0');

        if (batch.length > 0) {
            await redis.del(...batch);
            totalDeleted += batch.length;
        }

        if (totalDeleted > 0) {
            logger.info(`🧹 Cleared ${totalDeleted} cache keys matching: ${pattern}`);
        }
    } catch (err) {
        logger.error(`Redis clear cache error: ${err.message}`);
    }
};

module.exports = { cache, clearCache };
