const { serializeGameForActor } = require('../../../gameEngine/gameView');

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
 * Format game response for API through the allowlisted game view.
 * @param {Object} game - Raw game object from database/memory
 * @returns {Object} Safe game view
 */
const formatGameResponse = (game) => serializeGameForActor(game);

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
