/**
 * Response helper utilities for game handlers
 * Provides standardized response formatting functions
 */

/**
 * Send successful game update response
 * @param {Object} res - Express response object
 * @param {Object} game - Game object to return
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Express response
 */
const sendGameUpdate = (res, game, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    game,
  });
};

/**
 * Send lobby update notification
 * @param {Object} io - Socket.IO instance
 * @param {Object} payload - Update payload
 */
const sendLobbyUpdate = (io, payload = {}) => {
  if (!io || typeof io.emit !== 'function') return;
  
  io.emit('lobby_updated', {
    type: 'lobby_updated',
    timestamp: new Date().toISOString(),
    ...payload,
  });
};

/**
 * Format game response for API
 * @param {Object} game - Raw game object from database/memory
 * @returns {Object} Formatted game object
 */
const formatGameResponse = (game) => {
  if (!game) return null;

  return {
    id: game.id,
    hostName: game.host_name || game.hostName,
    guestName: game.guest_name || game.guestName,
    gameType: game.game_type || game.gameType,
    points: game.points,
    table: game.table_code || game.table,
    status: game.status,
    winner: game.winner || null,
    gameState: game.game_state || game.gameState || {},
    createdAt: game.created_at || game.createdAt,
  };
};

/**
 * Send success response with optional data
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Express response
 */
const sendSuccess = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    ...data,
  });
};

module.exports = {
  sendGameUpdate,
  sendLobbyUpdate,
  formatGameResponse,
  sendSuccess,
};
