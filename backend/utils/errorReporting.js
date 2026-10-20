/**
 * Error reporting to Sentry.
 *
 * server.js initialises Sentry when SENTRY_DSN is set; without it every call
 * here is a no-op. Most handlers catch their own errors and answer with a
 * generic 5xx, so those errors never reach Sentry's Express handler: they are
 * reported from here instead, either directly (sendApiError) or through the
 * logger's error transport.
 */
const Sentry = require('@sentry/node');

const isReportingEnabled = () => Sentry.isInitialized();

/** First Error among the values a log call was given, if any. */
const findError = (values) => {
  for (const value of values) {
    if (value instanceof Error) return value;
    if (value && typeof value === 'object') {
      for (const key of ['err', 'error', 'reason']) {
        if (value[key] instanceof Error) return value[key];
      }
    }
  }
  return null;
};

/**
 * Send an error to Sentry with the place it happened. Reporting the same Error
 * object twice is safe: Sentry drops errors it has already captured.
 */
const reportError = (err, { context, requestId } = {}) => {
  if (!(err instanceof Error) || !isReportingEnabled()) return;
  Sentry.withScope((scope) => {
    if (context) scope.setTag('context', String(context).slice(0, 200));
    if (requestId) scope.setTag('request_id', String(requestId));
    Sentry.captureException(err);
  });
};

module.exports = { findError, isReportingEnabled, reportError };
