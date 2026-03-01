/**
 * Chess-specific utilities for game handlers
 * Handles chess clock configuration, state management, and move validation
 */

const { Chess } = require('chess.js');
const { nextChessResult, parseIsoTimestampMs } = require('./utils/helperUtils');

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
      whiteMs: Number.isFinite(Number(sourceClock.whiteMs)) ? Number(sourceClock.whiteMs) : config.baseMs,
      blackMs: Number.isFinite(Number(sourceClock.blackMs)) ? Number(sourceClock.blackMs) : config.baseMs,
      lastTickAt: nowIso,
    },
    startedAt: source.startedAt || nowIso,
    updatedAt: nowIso,
  };
};

/**
 * Create initial chess state with clock configuration
 */
const createInitialChessState = (rawClockConfig) => {
  const chess = new Chess();
  const clockConfig = normalizeChessClockConfig(rawClockConfig);
  return {
    version: 1,
    fen: chess.fen(),
    turn: chess.turn(),
    inCheck: false,
    isGameOver: false,
    result: null,
    moveHistory: [],
    clock: {
      baseMs: clockConfig.baseMs,
      incrementMs: clockConfig.incrementMs,
      label: clockConfig.label,
      whiteMs: clockConfig.baseMs,
      blackMs: clockConfig.baseMs,
      lastTickAt: null,
    },
    startedAt: null,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Resolve participant color (white or black) for a chess game
 * Returns 'w' for white, 'b' for black, or null if not a participant
 */
const resolveParticipantColor = (participant, game) => {
  const host = String(game?.host_name || game?.hostName || '').trim();
  const guest = String(game?.guest_name || game?.guestName || '').trim();
  if (!participant) return null;
  if (participant.toLowerCase() === host.toLowerCase()) return 'w';
  if (participant.toLowerCase() === guest.toLowerCase()) return 'b';
  return null;
};

/**
 * Sanitize chess move payload
 */
const sanitizeChessMovePayload = (payload) => {
  const from = String(payload?.from || '').trim().toLowerCase();
  const to = String(payload?.to || '').trim().toLowerCase();
  const promotionRaw = String(payload?.promotion || '').trim().toLowerCase();
  const promotion = ['q', 'r', 'b', 'n'].includes(promotionRaw) ? promotionRaw : undefined;
  if (!CHESS_SQUARE_RE.test(from) || !CHESS_SQUARE_RE.test(to)) {
    return null;
  }
  return { from, to, ...(promotion ? { promotion } : {}) };
};

/**
 * Build chess state from chess.js engine state
 */
const buildChessStateFromEngine = (chess, previousState, lastMove) => {
  const moveHistory = Array.isArray(previousState?.moveHistory)
    ? previousState.moveHistory.slice(-300)
    : [];
  const entry = lastMove
    ? {
        from: lastMove.from,
        to: lastMove.to,
        san: lastMove.san,
        lan: lastMove.lan,
        color: lastMove.color,
        piece: lastMove.piece,
        captured: lastMove.captured || null,
        promotion: lastMove.promotion || null,
        ts: new Date().toISOString(),
      }
    : null;

  const nextHistory = entry ? [...moveHistory, entry] : moveHistory;
  return {
    version: 1,
    fen: chess.fen(),
    turn: chess.turn(),
    inCheck: chess.inCheck(),
    isGameOver: chess.isGameOver(),
    result: nextChessResult(chess),
    moveHistory: nextHistory,
    lastMove: entry,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Normalize runtime chess clock state
 */
const normalizeRuntimeChessClock = (rawClock) => {
  const source = rawClock && typeof rawClock === 'object' ? rawClock : {};
  const config = normalizeChessClockConfig(source);
  const whiteRaw = Number(source.whiteMs);
  const blackRaw = Number(source.blackMs);
  const parsedTick = parseIsoTimestampMs(source.lastTickAt);

  return {
    baseMs: config.baseMs,
    incrementMs: config.incrementMs,
    label: source.label ? String(source.label).slice(0, 32) : config.label,
    whiteMs: Number.isFinite(whiteRaw) ? Math.max(0, Math.floor(whiteRaw)) : config.baseMs,
    blackMs: Number.isFinite(blackRaw) ? Math.max(0, Math.floor(blackRaw)) : config.baseMs,
    lastTickAt: parsedTick ? new Date(parsedTick).toISOString() : null,
  };
};

/**
 * Build chess timeout resolution for when a player runs out of time
 */
const buildChessTimeoutResolution = ({
  gameType,
  status,
  hostName,
  guestName,
  gameState,
}) => {
  if (!isChessGameType(gameType)) return null;
  
  const { normalizeGameStatus, GAME_STATUS } = require('../../utils/gameStateMachine');
  
  if (normalizeGameStatus(status) !== GAME_STATUS.ACTIVE) return null;

  const currentState = gameState && typeof gameState === 'object' ? gameState : {};
  const currentChessState =
    currentState.chess && typeof currentState.chess === 'object'
      ? currentState.chess
      : null;
  if (!currentChessState) return null;

  const normalizedClock = normalizeRuntimeChessClock(currentChessState.clock);
  const lastTickAtMs = parseIsoTimestampMs(normalizedClock.lastTickAt);
  if (!lastTickAtMs) return null;

  let chess;
  try {
    chess = new Chess(String(currentChessState.fen || ''));
  } catch {
    chess = new Chess();
  }

  const activeColor = chess.turn() === 'b' ? 'b' : 'w';
  const activeClockKey = activeColor === 'w' ? 'whiteMs' : 'blackMs';
  const elapsedMs = Math.max(0, Date.now() - lastTickAtMs);
  const remainingMs = Math.max(0, Number(normalizedClock[activeClockKey] || 0) - elapsedMs);
  if (remainingMs > 0) return null;

  const host = String(hostName || '').trim();
  const guest = String(guestName || '').trim();
  const timeoutWinner = activeColor === 'w' ? guest : host;
  const nowIso = new Date().toISOString();

  const nextChessState = {
    ...buildChessStateFromEngine(chess, currentChessState, null),
    winner: timeoutWinner || null,
    result: 'timeout',
    isGameOver: true,
    timedOutColor: activeColor,
    clock: {
      ...normalizedClock,
      [activeClockKey]: 0,
      lastTickAt: null,
    },
    updatedAt: nowIso,
  };

  const nextGameState = {
    ...currentState,
    chess: nextChessState,
  };
  if (timeoutWinner) {
    nextGameState.resolvedWinner = timeoutWinner;
  } else if (nextGameState.resolvedWinner) {
    delete nextGameState.resolvedWinner;
  }

  return {
    winner: timeoutWinner || null,
    nextGameState,
    nextChessState,
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
  buildChessStateFromEngine,
  normalizeRuntimeChessClock,
  buildChessTimeoutResolution,
};
