/**
 * Game-level validation utilities
 * Handles game state validation, admin checks, and game type checks
 */

const NON_COMPETITIVE_GAME_TYPES = new Set([
  'UNO Sosyal',
  '101 Okey Sosyal',
  'Monopoly Sosyal',
]);

/**
 * Check if user is an admin actor
 * @param {Object} user - User object from request
 * @returns {boolean} True if user is admin
 */
const isAdminActor = (user) => user?.role === 'admin' || user?.isAdmin === true;

/**
 * Check if game type is non-competitive (social games)
 * @param {string} gameType - Game type to check
 * @returns {boolean} True if game is non-competitive
 */
const isNonCompetitiveGameType = (gameType) =>
  NON_COMPETITIVE_GAME_TYPES.has(String(gameType || '').trim());

/**
 * Validate game exists
 * @param {Object} game - Game object to validate
 * @returns {Object} Validation result with ok flag and error message
 */
const validateGameExists = (game) => {
  if (!game) {
    return { ok: false, error: 'Oyun bulunamadı.', status: 404 };
  }
  return { ok: true };
};

/**
 * Validate player is in game
 * @param {string} playerName - Player username
 * @param {Object} game - Game object
 * @returns {Object} Validation result
 */
const validatePlayerInGame = (playerName, game) => {
  const hostName = String(game?.host_name || game?.hostName || '').trim().toLowerCase();
  const guestName = String(game?.guest_name || game?.guestName || '').trim().toLowerCase();
  const player = String(playerName || '').trim().toLowerCase();

  if (!player || (player !== hostName && player !== guestName)) {
    return { ok: false, error: 'Bu oyunda yer almıyorsun.', status: 403 };
  }
  return { ok: true };
};

/**
 * Validate game is not finished
 * @param {Object} game - Game object
 * @returns {Object} Validation result
 */
const validateGameNotFinished = (game) => {
  const status = String(game?.status || '').toLowerCase();
  if (status === 'finished') {
    return { ok: false, error: 'Bu oyun zaten tamamlanmış.', status: 409 };
  }
  return { ok: true };
};

/**
 * Validate it's player's turn in chess game
 * @param {string} playerName - Player username
 * @param {Object} game - Game object with chess state
 * @returns {Object} Validation result
 */
const validatePlayerTurn = (playerName, game) => {
  const chessState = game?.game_state?.chess || game?.gameState?.chess;
  if (!chessState) {
    return { ok: true }; // Not a chess game or no state yet
  }

  const turn = chessState.turn;
  const hostName = String(game?.host_name || game?.hostName || '').trim().toLowerCase();
  const guestName = String(game?.guest_name || game?.guestName || '').trim().toLowerCase();
  const player = String(playerName || '').trim().toLowerCase();

  // Determine expected color for current turn
  const expectedPlayer = turn === 'w' ? hostName : guestName;

  if (player !== expectedPlayer) {
    return { ok: false, error: 'Şu an senin sıran değil.', status: 409 };
  }
  return { ok: true };
};

/**
 * Validate chess move format
 * @param {Object} move - Move object with from/to properties
 * @returns {Object} Validation result
 */
const validateMoveFormat = (move) => {
  if (!move || typeof move !== 'object') {
    return { ok: false, error: 'Geçersiz hamle formatı.', status: 400 };
  }

  const from = String(move.from || '').trim().toLowerCase();
  const to = String(move.to || '').trim().toLowerCase();
  const squareRegex = /^[a-h][1-8]$/;

  if (!squareRegex.test(from) || !squareRegex.test(to)) {
    return { ok: false, error: 'Geçersiz kare pozisyonu.', status: 400 };
  }

  return { ok: true };
};

module.exports = {
  NON_COMPETITIVE_GAME_TYPES,
  isAdminActor,
  isNonCompetitiveGameType,
  validateGameExists,
  validatePlayerInGame,
  validateGameNotFinished,
  validatePlayerTurn,
  validateMoveFormat,
};
