const logger = require('./logger');

/**
 * Roll a transaction back without letting the rollback's own failure escape.
 *
 * Handlers call this from their `catch` block. When the original error was a
 * dropped connection, `ROLLBACK` rejects as well; awaiting it bare threw out of
 * the catch block, skipped the error response and surfaced as an unhandled
 * rejection. The rollback failure is logged, and the caller still answers the
 * request with its own error.
 */
async function rollbackQuietly(client) {
  try {
    await client.query('ROLLBACK');
  } catch (err) {
    logger.warn('Transaction rollback failed', { error: err && err.message });
  }
}

module.exports = { rollbackQuietly };
