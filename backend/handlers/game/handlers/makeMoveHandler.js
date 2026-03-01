/**
 * Make Move Handler
 * Handles game moves including chess moves, live submissions, and score submissions
 * Delegates to gameMoveService for the actual move logic
 */

const { createGameMoveService } = require('../../../services/gameMoveService');

const createMakeMoveHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    normalizeParticipantName,
    normalizeGameType,
    isAdminActor,
    isChessGameType,
    resolveParticipantColor,
    sanitizeChessMovePayload,
    createInitialChessState,
    buildChessStateFromEngine,
    assertGameStatusTransition,
    assertRequiredGameStatus,
    getGameParticipants,
    pickWinnerFromResults,
    sanitizeScoreSubmission,
    sanitizeLiveSubmission,
    getMemoryGames,
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
    sanitizeLiveSubmission: (payload) => sanitizeLiveSubmission(payload, normalizeGameType),
    getGameParticipants,
    pickWinnerFromResults,
    sanitizeScoreSubmission,
    getMemoryGames,
    emitRealtimeUpdate,
  });

  return makeMove;
};

module.exports = {
  createMakeMoveHandler,
};
