/**
 * Error helper utilities for game handlers
 * Provides standardized error response formatting
 */

/**
 * Build standardized error response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {string} code - Optional error code
 * @returns {Object} Error response object
 */
const buildErrorResponse = (message, statusCode = 400, code = null) => {
  const error = {
    error: message,
  };

  if (code) {
    error.code = code;
  }

  return { statusCode, body: error };
};

/**
 * Map game state transition error to response
 * @param {Object} transitionResult - Result from assertGameStatusTransition
 * @returns {Object} Error response object
 */
const mapTransitionError = (transitionResult) => {
  if (!transitionResult) {
    return {
      error: 'Geçersiz durum geçişi.',
      code: 'invalid_transition',
    };
  }

  return {
    error: transitionResult.message || 'Geçersiz durum geçişi.',
    code: transitionResult.code || 'invalid_transition',
    fromStatus: transitionResult.from,
    toStatus: transitionResult.to,
  };
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Optional error code
 * @returns {Object} Express response
 */
const sendError = (res, message, statusCode = 400, code = null) => {
  const response = { error: message };
  if (code) {
    response.code = code;
  }
  return res.status(statusCode).json(response);
};

/**
 * Handle common game errors
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 * @param {Object} logger - Logger instance
 * @param {string} context - Error context for logging
 * @returns {Object} Express response
 */
const handleGameError = (res, error, logger, context = 'game_operation') => {
  logger.error(`${context} error`, error);
  
  // Check for known error types
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({ error: 'Veritabanı bağlantısı kurulamadı.' });
  }
  
  if (error.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({ error: 'Bu işlem çakışma nedeniyle yapılamadı.' });
  }

  // Generic error response
  return res.status(500).json({ error: 'İşlem sırasında bir hata oluştu.' });
};

module.exports = {
  buildErrorResponse,
  mapTransitionError,
  sendError,
  handleGameError,
};
