/**
 * Draw offer utilities for game handlers
 * Handles draw offer normalization and opponent finding
 */

const DRAW_OFFER_ACTIONS = new Set(['offer', 'accept', 'reject', 'cancel']);

/**
 * Normalize participant name to lowercase key
 */
const normalizeParticipantKey = (value) => String(value || '').trim().toLowerCase();

/**
 * Normalize draw offer action (offer, accept, reject, cancel)
 */
const normalizeDrawOfferAction = (value) => {
  const action = String(value || 'offer').trim().toLowerCase();
  return DRAW_OFFER_ACTIONS.has(action) ? action : null;
};

/**
 * Normalize draw offer object
 */
const normalizeDrawOffer = (rawOffer) => {
  if (!rawOffer || typeof rawOffer !== 'object') return null;
  const statusRaw = String(rawOffer.status || '').trim().toLowerCase();
  const offeredBy = String(rawOffer.offeredBy || '').trim();
  if (!offeredBy) return null;
  const status = ['pending', 'accepted', 'rejected', 'cancelled'].includes(statusRaw)
    ? statusRaw
    : 'pending';

  return {
    status,
    offeredBy,
    createdAt: rawOffer.createdAt ? String(rawOffer.createdAt) : new Date().toISOString(),
    respondedBy: rawOffer.respondedBy ? String(rawOffer.respondedBy) : undefined,
    respondedAt: rawOffer.respondedAt ? String(rawOffer.respondedAt) : undefined,
  };
};

/**
 * Create draw offer utilities with dependencies
 */
const createDrawOfferUtils = (getGameParticipants) => ({
  /**
   * Find opponent name for a given participant
   */
  findOpponentName: (actorParticipant, game) => {
    const actorKey = normalizeParticipantKey(actorParticipant);
    if (!actorKey) return null;
    const participants = getGameParticipants(game).filter(Boolean);
    return participants.find((name) => normalizeParticipantKey(name) !== actorKey) || null;
  },
});

module.exports = {
  DRAW_OFFER_ACTIONS,
  normalizeParticipantKey,
  normalizeDrawOfferAction,
  normalizeDrawOffer,
  createDrawOfferUtils,
};
