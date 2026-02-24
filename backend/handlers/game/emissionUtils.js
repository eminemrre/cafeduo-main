/**
 * Socket.IO emission utilities for game handlers
 * Provides centralized functions for emitting game and lobby updates
 */

/**
 * Create emission utilities with io instance
 * This allows the utilities to be used with the io instance from closure
 */
const createEmissionUtils = (io) => ({
  /**
   * Emit realtime game update to all clients in a game room
   */
  emitRealtimeUpdate: (gameId, payload) => {
    if (!io || !gameId) return;

    const room = `game_${gameId}`;
    io.to(room).emit('game_updated', {
      gameId,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Emit lobby update to all connected clients
   */
  emitLobbyUpdate: (payload = {}) => {
    if (!io) return;

    io.emit('lobby_updated', {
      timestamp: new Date().toISOString(),
      ...payload,
    });
  },
});

module.exports = {
  createEmissionUtils,
};
