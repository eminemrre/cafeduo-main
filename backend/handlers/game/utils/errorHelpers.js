const { sendApiProblem } = require('../../../utils/routeHelpers');

const DEFAULT_TRANSITION_MESSAGE = 'Geçersiz durum geçişi.';
const DEFAULT_TRANSITION_CODE = 'invalid_transition';

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
  sendTransitionError,
};
