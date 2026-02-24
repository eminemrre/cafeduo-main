/**
 * Chess-specific utilities for game handlers
 * Handles chess clock configuration, state management, and move validation
 */

const { Chess } = require('chess.js');

const CHESS_GAME_TYPE = 'Retro Satranç';
const CHESS_SQUARE_RE = /^[a-h][1-8]$/;

const DEFAULT_CHESS_CLOCK = Object.freeze({
  baseMs: 3 * 60 * 1000,
  incrementMs: 2 * 1000,
  label: '3+2 Blitz',
});

const CHESS_CLOCK_LIMITS = Object.freeze({
  minBaseSeconds: 60,
  maxBaseSeconds: 1800,
  minIncrementSeconds: 0,
  maxIncrementSeconds: 30,
});

/**
 * Check if a game type is chess
 */
const isChessGameType = (gameType) => String(gameType || '').trim() === CHESS_GAME_TYPE;

/**
 * Normalize chess clock configuration from various input formats
 */
const normalizeChessClockConfig = (rawClock) => {
  if (!rawClock || typeof rawClock !== 'object') {
    return { ...DEFAULT_CHESS_CLOCK };
  }

  const rawBaseSeconds = Number(
    rawClock.baseSeconds !== undefined
      ? rawClock.baseSeconds
      : rawClock.baseMs !== undefined
        ? Number(rawClock.baseMs) / 1000
        : DEFAULT_CHESS_CLOCK.baseMs / 1000
  );
  const rawIncrementSeconds = Number(
    rawClock.incrementSeconds !== undefined
      ? rawClock.incrementSeconds
      : rawClock.incrementMs !== undefined
        ? Number(rawClock.incrementMs) / 1000
        : DEFAULT_CHESS_CLOCK.incrementMs / 1000
  );

  const safeBaseSeconds = Number.isFinite(rawBaseSeconds)
    ? Math.min(CHESS_CLOCK_LIMITS.maxBaseSeconds, Math.max(CHESS_CLOCK_LIMITS.minBaseSeconds, Math.floor(rawBaseSeconds)))
    : DEFAULT_CHESS_CLOCK.baseMs / 1000;
  const safeIncrementSeconds = Number.isFinite(rawIncrementSeconds)
    ? Math.min(
        CHESS_CLOCK_LIMITS.maxIncrementSeconds,
        Math.max(CHESS_CLOCK_LIMITS.minIncrementSeconds, Math.floor(rawIncrementSeconds))
      )
    : DEFAULT_CHESS_CLOCK.incrementMs / 1000;

  return {
    baseMs: safeBaseSeconds * 1000,
    incrementMs: safeIncrementSeconds * 1000,
    label: `${safeBaseSeconds / 60}+${safeIncrementSeconds}`,
  };
};

/**
 * Activate chess clock state for a game
 */
const activateChessClockState = (state) => {
  const source = state && typeof state === 'object' ? state : createInitialChessState();
  const sourceClock = source.clock && typeof source.clock === 'object' ? source.clock : DEFAULT_CHESS_CLOCK;
  const config = normalizeChessClockConfig(sourceClock);
  const nowIso = new Date().toISOString();

  return {
    ...source,
    clock: {
      baseMs: config.baseMs,
      incrementMs: config.incrementMs,
      label: sourceClock.label || config.label,
      activeAt: nowIso,
      lastTickAt: nowIso,
    },
  };
};

/**
 * Create initial chess state with clock configuration
 */
const createInitialChessState = (rawClockConfig) => {
  const config = normalizeChessClockConfig(rawClockConfig);
  const nowIso = new Date().toISOString();

  return {
    fen: 'startpos',
    moveHistory: [],
    clock: {
      baseMs: config.baseMs,
      incrementMs: config.incrementMs,
      label: config.label,
      activeAt: nowIso,
      lastTickAt: nowIso,
      whiteRemainingMs: config.baseMs,
      blackRemainingMs: config.baseMs,
    },
  };
};

/**
 * Resolve participant color (white or black) for a chess game
 */
const resolveParticipantColor = (participant, game) => {
  if (!game || !game.gameState || !game.gameState.chess) {
    return null;
  }

  const { player1, player2 } = game;
  const moveHistory = game.gameState.chess.moveHistory || [];

  // First player is white, second is black
  if (participant === player1) return 'white';
  if (participant === player2) return 'black';

  // For guest names, check move history
  const hasMovedAsWhite = moveHistory.some(m => m.player === participant && m.color === 'white');
  const hasMovedAsBlack = moveHistory.some(m => m.player === participant && m.color === 'black');

  if (hasMovedAsWhite) return 'white';
  if (hasMovedAsBlack) return 'black';

  // Default: if odd number of moves, next is black; if even, next is white
  return moveHistory.length % 2 === 0 ? 'white' : 'black';
};

/**
 * Sanitize chess move payload
 */
const sanitizeChessMovePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const { from, to, promotion } = payload;

  if (typeof from !== 'string' || !CHESS_SQUARE_RE.test(from)) {
    return null;
  }

  if (typeof to !== 'string' || !CHESS_SQUARE_RE.test(to)) {
    return null;
  }

  const validPromotions = new Set(['q', 'r', 'b', 'n', 'queen', 'rook', 'bishop', 'knight']);
  const sanitizedPromotion =
    promotion && validPromotions.has(String(promotion).toLowerCase())
      ? String(promotion).toLowerCase().charAt(0)
      : undefined;

  return {
    from,
    to,
    promotion: sanitizedPromotion,
  };
};

/**
 * Get the next chess result (checkmate, draw, etc.)
 */
const nextChessResult = (chess) => {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isDraw()) return 'draw';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isInsufficientMaterial()) return 'insufficient_material';
  if (chess.isThreefoldRepetition()) return 'threefold_repetition';
  return null;
};

/**
 * Build chess state from chess.js engine state
 */
const buildChessStateFromEngine = (chess, previousState, lastMove) => {
  const entry = lastMove && typeof lastMove === 'object' ? lastMove : null;

  return {
    fen: chess.fen(),
    moveHistory: chess.history({ verbose: true }).map((move, idx) => ({
      color: move.color,
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured: move.captured || undefined,
      promotion: move.promotion || undefined,
      san: move.san,
      before: idx === 0 ? undefined : chess.history({ verbose: true })[idx - 1].before,
      after: move.after,
      player: entry?.player || (move.color === 'w' ? previousState?.player1 : previousState?.player2),
      timestamp: entry?.timestamp || new Date().toISOString(),
    })),
  };
};

/**
 * Parse ISO timestamp to milliseconds
 */
const parseIsoTimestampMs = (value) => {
  if (!value) return Date.now();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : Date.now();
};

/**
 * Normalize runtime chess clock state
 */
const normalizeRuntimeChessClock = (rawClock) => {
  if (!rawClock || typeof rawClock !== 'object') {
    return null;
  }

  const baseMs = Number(rawClock.baseMs) || DEFAULT_CHESS_CLOCK.baseMs;
  const incrementMs = Number(rawClock.incrementMs) || DEFAULT_CHESS_CLOCK.incrementMs;
  const whiteRemainingMs = Number(rawClock.whiteRemainingMs) ?? baseMs;
  const blackRemainingMs = Number(rawClock.blackRemainingMs) ?? baseMs;
  const activeAt = rawClock.activeAt || new Date().toISOString();
  const lastTickAt = rawClock.lastTickAt || activeAt;

  return {
    baseMs,
    incrementMs,
    whiteRemainingMs: Math.max(0, whiteRemainingMs),
    blackRemainingMs: Math.max(0, blackRemainingMs),
    activeAt,
    lastTickAt,
    label: rawClock.label || `${baseMs / 60000}+${incrementMs / 1000}`,
  };
};

/**
 * Build chess timeout resolution for when a player runs out of time
 */
const buildChessTimeoutResolution = ({
  game,
  nowMs = Date.now(),
  logger = console,
}) => {
  const chessState = game?.gameState?.chess;
  if (!chessState) {
    return null;
  }

  const clock = normalizeRuntimeChessClock(chessState.clock);
  if (!clock) {
    return null;
  }

  const lastTickMs = parseIsoTimestampMs(clock.lastTickAt);
  const elapsedMs = nowMs - lastTickMs;

  const { player1, player2 } = game;
  const moveHistory = chessState.moveHistory || [];
  const nextToMoveColor = moveHistory.length % 2 === 0 ? 'white' : 'black';

  let nextWhiteRemainingMs = clock.whiteRemainingMs;
  let nextBlackRemainingMs = clock.blackRemainingMs;
  let timedOutColor = null;

  if (nextToMoveColor === 'white') {
    nextWhiteRemainingMs = Math.max(0, clock.whiteRemainingMs - elapsedMs);
    if (nextWhiteRemainingMs === 0) {
      timedOutColor = 'white';
    }
  } else {
    nextBlackRemainingMs = Math.max(0, clock.blackRemainingMs - elapsedMs);
    if (nextBlackRemainingMs === 0) {
      timedOutColor = 'black';
    }
  }

  const nextClock = {
    ...clock,
    whiteRemainingMs: nextWhiteRemainingMs,
    blackRemainingMs: nextBlackRemainingMs,
    lastTickAt: new Date(nowMs).toISOString(),
  };

  if (timedOutColor) {
    const winnerColor = timedOutColor === 'white' ? 'black' : 'white';
    const winner = winnerColor === 'white' ? player1 : player2;

    return {
      timedOut: true,
      timedOutColor,
      winnerColor,
      winner,
      reason: 'timeout',
      nextChessState: {
        ...chessState,
        clock: nextClock,
      },
      nextGameState: {
        status: 'finished',
        finishedAt: new Date(nowMs).toISOString(),
        finishedBy: 'timeout',
        winner,
      },
    };
  }

  return {
    timedOut: false,
    nextChessState: {
      ...chessState,
      clock: nextClock,
    },
  };
};

module.exports = {
  CHESS_GAME_TYPE,
  CHESS_SQUARE_RE,
  DEFAULT_CHESS_CLOCK,
  CHESS_CLOCK_LIMITS,
  isChessGameType,
  normalizeChessClockConfig,
  activateChessClockState,
  createInitialChessState,
  resolveParticipantColor,
  sanitizeChessMovePayload,
  nextChessResult,
  buildChessStateFromEngine,
  parseIsoTimestampMs,
  normalizeRuntimeChessClock,
  buildChessTimeoutResolution,
};
