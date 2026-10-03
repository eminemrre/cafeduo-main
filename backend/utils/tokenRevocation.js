const redisClient = require('../config/redis');
const { isProductionEnv } = require('./securityConfig');

class TokenRevocationUnavailableError extends Error {
  constructor() {
    super('Authentication service temporarily unavailable');
    this.name = 'TokenRevocationUnavailableError';
  }
}

// A configured shared store remains authoritative while connecting or recovering.
// Memory-only development and explicitly selected fail-open HTTP mode remain supported.
const isTokenRevoked = async (token, { failMode = 'closed' } = {}) => {
  const failClosed = failMode === 'closed';
  if (redisClient?.status === 'ready') {
    try {
      if (await redisClient.get(`blacklist:token:${token}`)) return true;
    } catch {
      if (failClosed) throw new TokenRevocationUnavailableError();
    }
  } else if (failClosed && (redisClient || isProductionEnv())) {
    throw new TokenRevocationUnavailableError();
  }

  // Also respect local revocations made during an explicitly allowed memory fallback.
  const expiry = global.tokenBlacklist?.get(token);
  if (expiry) {
    if (expiry <= Math.floor(Date.now() / 1000)) {
      global.tokenBlacklist.delete(token);
    } else {
      return true;
    }
  }
  return false;
};

module.exports = { isTokenRevoked, TokenRevocationUnavailableError };
