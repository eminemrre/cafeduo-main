/**
 * Make Move Handler
 * Handles game moves including chess moves, live submissions, and score submissions
 * Delegates to gameMoveService for the actual move logic
 */

const { createGameMoveService } = require('../../../services/gameMoveService');
const { applyDbSettlement, applyMemorySettlement } = require('../settlementUtils');

const createMakeMoveHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    normalizeParticipantName,
    isAdminActor,
    isChessGameType,
    resolveParticipantColor,
    sanitizeChessMovePayload,
    createInitialChessState,
    buildChessStateFromEngine,
    assertGameStatusTransition,
    assertRequiredGameStatus,
    getMemoryGames,
    getMemoryUsers,
    io,
  } = deps;

  const emitRealtimeUpdate = (gameId, payload) => {
    try {
      if (!io || typeof io.to !== 'function') return;
      const room = String(gameId || '').trim();
      if (!room) return;
      io.to(room).emit('game_state_updated', payload);
    } catch (err) {
      logger.warn('Realtime emit failed', err);
    }
  };

  const { mapTransitionError } = require('../utils/errorHelpers');

  const { makeMove } = createGameMoveService({
    pool,
    isDbConnected,
    logger,
    normalizeParticipantName,
    isAdminActor,
    isChessGameType,
    resolveParticipantColor,
    sanitizeChessMovePayload,
    createInitialChessState,
    buildChessStateFromEngine,
    assertGameStatusTransition,
    assertRequiredGameStatus,
    mapTransitionError,
    getMemoryGames,
    emitRealtimeUpdate,
    applyDbSettlement,
    applyMemorySettlement,
    getMemoryUsers,
  });

  return makeMove;
};

module.exports = {
  createMakeMoveHandler,
};
