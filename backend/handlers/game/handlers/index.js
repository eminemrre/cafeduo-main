/**
 * Game Handlers Barrel Export
 * Exports all individual handler creators
 */

const { createDeleteGameHandler } = require('./deleteGameHandler');
const { createHistoryHandler } = require('./historyHandler');
const { createGetGameStateHandler } = require('./getGameStateHandler');
const { createCreateGameHandler } = require('./createGameHandler');
const { createResignGameHandler } = require('./resignGameHandler');
const { createJoinGameHandler } = require('./joinGameHandler');
const { createFinishGameHandler } = require('./finishGameHandler');
const { createDrawOfferHandler } = require('./drawOfferHandler');
const { createMakeMoveHandler } = require('./makeMoveHandler');
const { createGetGamesHandler } = require('./getGamesHandler');

module.exports = {
  createDeleteGameHandler,
  createHistoryHandler,
  createGetGameStateHandler,
  createCreateGameHandler,
  createResignGameHandler,
  createJoinGameHandler,
  createFinishGameHandler,
  createDrawOfferHandler,
  createMakeMoveHandler,
  createGetGamesHandler,
};
