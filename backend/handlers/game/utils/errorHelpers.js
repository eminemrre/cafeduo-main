const { sendApiProblem } = require('../../../utils/routeHelpers');

const DEFAULT_TRANSITION_MESSAGE = 'Geçersiz durum geçişi.';
const DEFAULT_TRANSITION_CODE = 'invalid_transition';

/**
 * Legacy body for a rejected game state transition.
 * Still used by the draw-offer and move handlers until they move to sendTransitionError.
 * @param {Object} transitionResult - Result from assertGameStatusTransition
 * @returns {Object} Error response body
 */
const mapTransitionError = (transitionResult) => {
  if (!transitionResult) {
    return {
      error: DEFAULT_TRANSITION_MESSAGE,
      code: DEFAULT_TRANSITION_CODE,
    };
  }

  return {
    error: transitionResult.message || DEFAULT_TRANSITION_MESSAGE,
    code: transitionResult.code || DEFAULT_TRANSITION_CODE,
    fromStatus: transitionResult.from,
    toStatus: transitionResult.to,
  };
};

/**
 * Answer a rejected game state transition with the shared error contract.
 * @param {Object} res - Express response object
 * @param {Object} transitionResult - Result from assertGameStatusTransition
 * @param {number} status - HTTP status code
 * @returns {Object} Express response
 */
const sendTransitionError = (res, transitionResult, status = 409) =>
  sendApiProblem(res, {
    status,
    code: transitionResult?.code || DEFAULT_TRANSITION_CODE,
    message: transitionResult?.message || DEFAULT_TRANSITION_MESSAGE,
    details: transitionResult
      ? { fromStatus: transitionResult.from, toStatus: transitionResult.to }
      : null,
  });

module.exports = {
  mapTransitionError,
  sendTransitionError,
};
