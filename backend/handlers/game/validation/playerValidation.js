/**
 * Player and participant validation utilities
 * Handles participant name normalization and validation
 */

/**
 * Normalize participant name to lowercase key for comparison
 * @param {string} value - Participant name
 * @returns {string} Normalized lowercase name
 */
const normalizeParticipantKey = (value) => String(value || '').trim().toLowerCase();

/**
 * Validate participant has enough points for stake
 * @param {Object} user - User object with points
 * @param {number} stake - Required stake amount
 * @returns {Object} Validation result
 */
const validateStakeRequirement = (user, stake) => {
  const userPoints = Math.max(0, Math.floor(Number(user?.points || 0)));
  const requiredStake = Math.max(0, Math.floor(Number(stake || 0)));

  if (userPoints < requiredStake) {
    return {
      ok: false,
      error: `Bu oyuna katılmak için en az ${requiredStake} puan gerekli. Mevcut: ${userPoints}`,
      status: 400,
    };
  }

  return { ok: true };
};

/**
 * Find opponent name for a given participant
 * @param {string} actorParticipant - Current participant name
 * @param {Object} game - Game object with host_name/guest_name
 * @param {Function} getGameParticipants - Function to get game participants
 * @returns {string|null} Opponent name or null
 */
const findOpponentName = (actorParticipant, game, getGameParticipants) => {
  const actorKey = normalizeParticipantKey(actorParticipant);
  if (!actorKey) return null;
  
  const participants = getGameParticipants(game).filter(Boolean);
  return participants.find((name) => normalizeParticipantKey(name) !== actorKey) || null;
};

/**
 * Validate participant is in the game
 * @param {string} participant - Participant name to validate
 * @param {Object} game - Game object
 * @returns {Object} Validation result
 */
const validateParticipantInGame = (participant, game) => {
  const hostName = String(game?.host_name || game?.hostName || '').trim().toLowerCase();
  const guestName = String(game?.guest_name || game?.guestName || '').trim().toLowerCase();
  const participantKey = normalizeParticipantKey(participant);

  if (!participantKey || (participantKey !== hostName && participantKey !== guestName)) {
    return {
      ok: false,
      error: 'Bu oyunda işlem yapma yetkin yok.',
      status: 403,
    };
  }

  return { ok: true };
};

module.exports = {
  normalizeParticipantKey,
  validateStakeRequirement,
  findOpponentName,
  validateParticipantInGame,
};
