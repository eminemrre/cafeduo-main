/**
 * General helper utilities for game handlers
 * Miscellaneous utility functions used across game handlers
 */

const { getGameScoreBounds } = require('../../../../shared/gameRegistry');

/**
 * Determine chess game result from chess.js instance
 * @param {Object} chess - chess.js instance
 * @returns {string|null} Result type or null if game continues
 */
const nextChessResult = (chess) => {
  if (!chess) return null;

  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isInsufficientMaterial()) return 'insufficient-material';
  if (chess.isThreefoldRepetition()) return 'threefold-repetition';
  if (chess.isDraw()) return 'draw';

  return null;
};

/**
 * Parse ISO timestamp string to milliseconds
 * @param {string} value - ISO timestamp string
 * @returns {number|null} Milliseconds since epoch or null if invalid
 */
const parseIsoTimestampMs = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Safe integer conversion with bounds
 * @param {*} value - Value to convert
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} defaultValue - Default if invalid
 * @returns {number} Safe integer within bounds
 */
const safeInteger = (value, min = 0, max = Number.MAX_SAFE_INTEGER, defaultValue = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, Math.floor(num)));
};

/**
 * Sanitize live game submission payload
 * The score, rounds and round number are clamped to the bounds of the stored game type,
 * so a client cannot win by submitting an impossible score.
 * @param {Object} payload - Raw submission payload
 * @param {string} gameType - Stored game type of the match (authoritative)
 * @param {Function} normalizeGameType - Function to normalize game type
 * @returns {Object} Sanitized submission object
 */
const sanitizeLiveSubmission = (payload, gameType, normalizeGameType) => {
  const bounds = getGameScoreBounds(gameType);
  const maxScore = bounds?.maxScore ?? Number.MAX_SAFE_INTEGER;
  const maxRounds = bounds?.maxRounds ?? Number.MAX_SAFE_INTEGER;
  const safeScore = safeInteger(payload?.score, 0, maxScore);
  const safeRounds = safeInteger(payload?.roundsWon || safeScore, 0, maxScore);
  const safeRound = safeInteger(payload?.round, 0, maxRounds);
  const done = Boolean(payload?.done);
  const mode = normalizeGameType ? normalizeGameType(payload?.mode) : null;
  const submissionKeyRaw = String(payload?.submissionKey || payload?.submission_key || '').trim();
  const submissionKey = submissionKeyRaw ? submissionKeyRaw.slice(0, 96) : undefined;

  return {
    mode,
    score: safeScore,
    roundsWon: safeRounds,
    round: safeRound,
    done,
    ...(submissionKey ? { submissionKey } : {}),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Generate ISO timestamp string for current time
 * @returns {string} ISO 8601 timestamp
 */
const nowIso = () => new Date().toISOString();

module.exports = {
  nextChessResult,
  parseIsoTimestampMs,
  sanitizeLiveSubmission,
  safeInteger,
  nowIso,
};
