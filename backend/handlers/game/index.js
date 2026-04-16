/**
 * Game Handler Utilities - Barrel Export
 *
 * This directory contains modular utilities extracted from gameHandlers.js.
 * Each module serves a specific domain:
 *
 * - chessUtils.js     : Chess clock config, state management, timeout resolution
 * - emissionUtils.js  : Socket.IO emission helpers (game_updated, lobby_updated)
 * - settlementUtils.js: Point transfers, win/loss statistics, game settlement
 * - drawOfferUtils.js : Draw offer normalization, opponent resolution
 *
 * The main gameHandlers.js file imports these utilities for the route handlers.
 */

const chessUtils = require('./chessUtils');
const { createEmissionUtils } = require('./emissionUtils');
const settlementUtils = require('./settlementUtils');
const drawOfferUtils = require('./drawOfferUtils');

module.exports = {
  ...chessUtils,
  createEmissionUtils,
  ...settlementUtils,
  ...drawOfferUtils,
};
