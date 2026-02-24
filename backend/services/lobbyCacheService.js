/**
 * Lobby Cache Service
 * 
 * Redis tabanlı lobby cache katmanı.
 * Waiting games listelerini cache'leyerek DB yükünü azaltır.
 * 
 * Cache Strategy:
 * - Cache-aside pattern
 * - Short TTL (5 saniye) - stale data riskini minimize
 * - Write-through invalidation - oyun değiştiğinde anında cache temizle
 * - Graceful fallback - Redis yoksa DB'ye düşer
 * 
 * Cache Keys:
 * - lobby:all           -> Tüm waiting games
 * - lobby:table:{code}  -> Masa bazlı games
 * - lobby:cafe:{id}     -> Kafe bazlı games
 */

const logger = require('../utils/logger');

const CACHE_TTL_SECONDS = 5;
const CACHE_PREFIX = 'lobby:';

/**
 * Cache key oluşturucular
 */
const cacheKeys = {
  all: () => `${CACHE_PREFIX}all`,
  table: (tableCode) => `${CACHE_PREFIX}table:${String(tableCode).toLowerCase()}`,
  cafe: (cafeId) => `${CACHE_PREFIX}cafe:${cafeId}`,
};

/**
 * Cache'den oyun listesi getir
 * @param {Object} redisClient - Redis client instance
 * @param {string} key - Cache key
 * @returns {Promise<Array|null>} - Cached games or null if miss
 */
const getCachedGames = async (redisClient, key) => {
  if (!redisClient) {
    return null;
  }

  try {
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    logger.warn(`Lobby cache get failed for key ${key}: ${error.message}`);
    return null;
  }
};

/**
 * Oyun listesini cache'e yaz
 * @param {Object} redisClient - Redis client instance
 * @param {string} key - Cache key
 * @param {Array} games - Games array
 * @returns {Promise<void>}
 */
const setCachedGames = async (redisClient, key, games) => {
  if (!redisClient) {
    return;
  }

  try {
    await redisClient.setex(key, CACHE_TTL_SECONDS, JSON.stringify(games));
  } catch (error) {
    logger.warn(`Lobby cache set failed for key ${key}: ${error.message}`);
  }
};

/**
 * Cache invalidation - oyun değiştiğinde çağrılır
 * @param {Object} redisClient - Redis client instance
 * @param {Object} params - { tableCode, cafeId, invalidateAll }
 * @returns {Promise<void>}
 */
const invalidateLobbyCache = async (redisClient, { tableCode, cafeId, invalidateAll = false } = {}) => {
  if (!redisClient) {
    return;
  }

  try {
    const keysToDelete = [];

    if (invalidateAll) {
      // Tüm lobby cache'ini temizle
      const pattern = `${CACHE_PREFIX}*`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.debug(`Invalidated ${keys.length} lobby cache entries (all)`);
      }
      return;
    }

    // Spesifik key'leri temizle
    keysToDelete.push(cacheKeys.all());

    if (tableCode) {
      keysToDelete.push(cacheKeys.table(tableCode));
    }

    if (cafeId) {
      keysToDelete.push(cacheKeys.cafe(cafeId));
    }

    if (keysToDelete.length > 0) {
      await redisClient.del(...keysToDelete);
      logger.debug(`Invalidated lobby cache: ${keysToDelete.join(', ')}`);
    }
  } catch (error) {
    logger.warn(`Lobby cache invalidation failed: ${error.message}`);
  }
};

/**
 * Lobby cache service factory
 * @param {Object} params - { redisClient }
 * @returns {Object} - Lobby cache service
 */
const createLobbyCacheService = ({ redisClient }) => {
  /**
   * Cache'den veya DB'den waiting games getir
   * @param {Object} params - Query parameters
   * @param {Function} dbFetcher - DB fetch function (fallback)
   * @returns {Promise<Array>}
   */
  const getWaitingGames = async ({ scope, tableCode, cafeId }, dbFetcher) => {
    let cacheKey;
    let cachedGames;

    // Cache key belirle
    if (scope === 'table' && tableCode) {
      cacheKey = cacheKeys.table(tableCode);
    } else if (scope === 'cafe' && cafeId) {
      cacheKey = cacheKeys.cafe(cafeId);
    } else {
      cacheKey = cacheKeys.all();
    }

    // Cache'ten dene
    cachedGames = await getCachedGames(redisClient, cacheKey);
    if (cachedGames !== null) {
      logger.debug(`Lobby cache hit: ${cacheKey}`);
      return cachedGames;
    }

    // Cache miss - DB'den getir
    logger.debug(`Lobby cache miss: ${cacheKey}, fetching from DB`);
    const games = await dbFetcher();

    // Cache'e yaz (async, fire-and-forget)
    setCachedGames(redisClient, cacheKey, games).catch((err) => {
      logger.warn(`Failed to cache lobby games: ${err.message}`);
    });

    return games;
  };

  /**
   * Oyun oluşturulduğunda cache'i invalidate et
   */
  const onGameCreated = async ({ tableCode, cafeId }) => {
    await invalidateLobbyCache(redisClient, { tableCode, cafeId, invalidateAll: true });
  };

  /**
   * Oyun katıldığında cache'i invalidate et
   */
  const onGameJoined = async ({ tableCode }) => {
    await invalidateLobbyCache(redisClient, { tableCode, invalidateAll: true });
  };

  /**
   * Oyun silindiğinde cache'i invalidate et
   */
  const onGameDeleted = async ({ tableCode }) => {
    await invalidateLobbyCache(redisClient, { tableCode, invalidateAll: true });
  };

  /**
   * Oyun bittiğinde cache'i invalidate et
   */
  const onGameFinished = async ({ tableCode }) => {
    await invalidateLobbyCache(redisClient, { tableCode, invalidateAll: true });
  };

  /**
   * Manuel cache temizleme (admin için)
   */
  const clearAllCache = async () => {
    await invalidateLobbyCache(redisClient, { invalidateAll: true });
  };

  /**
   * Cache istatistikleri (monitoring için)
   */
  const getCacheStats = async () => {
    if (!redisClient) {
      return { enabled: false };
    }

    try {
      const pattern = `${CACHE_PREFIX}*`;
      const keys = await redisClient.keys(pattern);
      const infos = await Promise.all(
        keys.map(async (key) => {
          const ttl = await redisClient.ttl(key);
          return { key, ttl };
        })
      );

      return {
        enabled: true,
        keyCount: keys.length,
        keys: infos,
      };
    } catch (error) {
      logger.warn(`Failed to get cache stats: ${error.message}`);
      return { enabled: true, error: error.message };
    }
  };

  return {
    getWaitingGames,
    onGameCreated,
    onGameJoined,
    onGameDeleted,
    onGameFinished,
    clearAllCache,
    getCacheStats,
  };
};

module.exports = {
  createLobbyCacheService,
  cacheKeys,
};
