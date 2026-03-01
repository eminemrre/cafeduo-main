/**
 * Game Handlers Orchestrator
 * Main entry point that creates and exports all game route handlers
 * Phase 3: Pure orchestrator - all business logic extracted to modules
 */

const { GAME_STATUS } = require('../utils/gameStateMachine');

// Import chess utilities (still needed by some handlers)
const {
  isChessGameType,
  normalizeChessClockConfig,
  activateChessClockState,
  createInitialChessState,
  resolveParticipantColor,
  sanitizeChessMovePayload,
  buildChessStateFromEngine,
  normalizeRuntimeChessClock,
  buildChessTimeoutResolution,
} = require('./game/chessUtils');

// Import emission utilities
const {
  createEmissionUtils,
} = require('./game/emissionUtils');

// Import settlement utilities
const {
  isNonCompetitiveGameType,
  applyDbSettlement,
  applyMemorySettlement,
} = require('./game/settlementUtils');

// Import draw offer utilities
const {
  normalizeDrawOfferAction,
  normalizeDrawOffer,
  createDrawOfferUtils,
} = require('./game/drawOfferUtils');

// Import extracted handlers (Phase 2 + Phase 3)
const {
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
} = require('./game/handlers');

const createGameHandlers = ({
  pool,
  isDbConnected,
  logger,
  supportedGameTypes,
  normalizeGameType,
  normalizeTableCode,
  getGameParticipants,
  normalizeParticipantName,
  sanitizeScoreSubmission,
  pickWinnerFromResults,
  gameService,
  lobbyCacheService,
  getMemoryGames,
  setMemoryGames,
  getMemoryUsers,
  io,
}) => {
  // Create emission utilities
  const { emitRealtimeUpdate, emitLobbyUpdate } = createEmissionUtils({ io, logger });

  // Create draw offer utilities
  const { createDrawOffer, acceptDrawOffer, rejectDrawOffer, cancelDrawOffer } = createDrawOfferUtils({
    pool,
    isDbConnected,
    logger,
    normalizeParticipantName,
    getMemoryGames,
    setMemoryGames,
    getMemoryUsers,
    emitRealtimeUpdate,
    GAME_STATUS,
  });

  // ──────────────────────────────────────────────────────
  // Create all handlers
  // ──────────────────────────────────────────────────────

  const createGame = createCreateGameHandler({
    pool,
    isDbConnected,
    logger,
    normalizeGameType,
    normalizeTableCode,
    gameService,
    lobbyCacheService,
    getMemoryGames,
    setMemoryGames,
    emitLobbyUpdate,
  });

  const joinGame = createJoinGameHandler({
    pool,
    isDbConnected,
    logger,
    normalizeTableCode,
    normalizeParticipantName,
    gameService,
    lobbyCacheService,
    getMemoryGames,
    emitRealtimeUpdate,
    emitLobbyUpdate,
    GAME_STATUS,
  });

  const getGames = createGetGamesHandler({
    pool,
    isDbConnected,
    normalizeTableCode,
    supportedGameTypes,
    gameService,
    getMemoryGames,
  });

  const getGameState = createGetGameStateHandler({
    pool,
    isDbConnected,
    logger,
    buildChessTimeoutResolution,
    getMemoryGames,
    emitRealtimeUpdate,
  });

  const getUserGameHistory = createHistoryHandler({
    pool,
    isDbConnected,
    logger,
    supportedGameTypes,
    getMemoryGames,
  });

  const makeMove = createMakeMoveHandler({
    pool,
    isDbConnected,
    logger,
    normalizeParticipantName,
    normalizeGameType,
    isAdminActor: require('./game/validation').isAdminActor,
    isChessGameType,
    resolveParticipantColor,
    sanitizeChessMovePayload,
    createInitialChessState,
    buildChessStateFromEngine,
    assertGameStatusTransition: require('../utils/gameStateMachine').assertGameStatusTransition,
    assertRequiredGameStatus: require('../utils/gameStateMachine').assertRequiredGameStatus,
    getGameParticipants,
    pickWinnerFromResults,
    sanitizeScoreSubmission,
    sanitizeLiveSubmission: (payload) => require('./game/utils/helperUtils').sanitizeLiveSubmission(payload, normalizeGameType),
    getMemoryGames,
    io,
  });

  const drawOffer = createDrawOfferHandler({
    pool,
    isDbConnected,
    logger,
    normalizeParticipantName,
    getMemoryGames,
    setMemoryGames,
    getMemoryUsers,
    emitRealtimeUpdate,
  });

  const resignGame = createResignGameHandler({
    pool,
    isDbConnected,
    logger,
    normalizeParticipantName,
    getGameParticipants,
    gameService,
    getMemoryGames,
    setMemoryGames,
    getMemoryUsers,
    emitRealtimeUpdate,
    GAME_STATUS,
  });

  const finishGame = createFinishGameHandler({
    pool,
    isDbConnected,
    logger,
    getGameParticipants,
    normalizeParticipantName,
    pickWinnerFromResults,
    gameService,
    getMemoryGames,
    setMemoryGames,
    getMemoryUsers,
    emitRealtimeUpdate,
  });

  const deleteGame = createDeleteGameHandler({
    pool,
    isDbConnected,
    logger,
    lobbyCacheService,
    getMemoryGames,
    setMemoryGames,
    emitLobbyUpdate,
  });

  // ──────────────────────────────────────────────────────
  // Export all handlers
  // ──────────────────────────────────────────────────────

  return {
    getGames,
    createGame,
    joinGame,
    getGameState,
    getUserGameHistory,
    makeMove,
    drawOffer,
    resignGame,
    finishGame,
    deleteGame,
  };
};

module.exports = {
  createGameHandlers,
};
