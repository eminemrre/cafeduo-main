/**
 * Validation utilities barrel export
 * Centralizes all validation functions for game handlers
 */

const gameValidation = require('./gameValidation');
const playerValidation = require('./playerValidation');

module.exports = {
  ...gameValidation,
  ...playerValidation,
};
