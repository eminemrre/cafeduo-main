const redis = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Redis Caching Middleware
 * @param {number} duration - Cache duration in seconds
 */
const cache = (duration = 300) => {
    return async (req, res, next) => {
        // Skip caching for non-GET requests
        if (req.method !== 'GET') {
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
 * Clear cache by key pattern
 * @param {string} pattern - Redis key pattern (e.g. "cache:/api/cafes*")
 */
const clearCache = async (pattern) => {
    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(keys);
            logger.info(`🧹 Cleared cache keys: ${keys.join(', ')}`);
        }
    } catch (err) {
        logger.error(`Redis clear cache error: ${err.message}`);
    }
};

module.exports = { cache, clearCache };
