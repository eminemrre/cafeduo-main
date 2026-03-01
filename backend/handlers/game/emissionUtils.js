/**
 * Socket.IO emission utilities for game handlers
 * Provides centralized functions for emitting game and lobby updates
 */

/**
 * Create emission utilities with io instance and logger
 * @param {Object} deps - Dependencies
 * @param {Object} deps.io - Socket.IO server instance (may be null/undefined)
 * @param {Object} deps.logger - Logger instance
 * @returns {Object} Emission utility functions
 */
const createEmissionUtils = (deps) => {
  // Support both createEmissionUtils(io) and createEmissionUtils({ io, logger })
  const io = deps && typeof deps === 'object' && deps.io !== undefined ? deps.io : deps;
  const logger = deps && typeof deps === 'object' && deps.logger ? deps.logger : { warn: () => {} };

  return {
    /**
     * Emit realtime game update to all clients in a game room
     */
    emitRealtimeUpdate: (gameId, payload) => {
      try {
        if (!io || typeof io.to !== 'function') return;
        const room = String(gameId || '').trim();
        if (!room) return;
        io.to(room).emit('game_state_updated', payload);
      } catch (err) {
        logger.warn('Realtime emit failed', err);
      }
    },

    /**
     * Emit lobby update to all connected clients
     */
    emitLobbyUpdate: (payload = {}) => {
      try {
        if (!io || typeof io.emit !== 'function') return;
        io.emit('lobby_updated', {
          type: 'lobby_updated',
          ts: Date.now(),
          ...payload,
        });
      } catch (err) {
        logger.warn('Lobby emit failed', err);
      }
    },
  };
};

module.exports = {
  createEmissionUtils,
};
