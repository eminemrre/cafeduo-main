const winston = require('winston');
const { findError, reportError } = require('./errorReporting');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
// Always enable console logging for container environments (Render)
logger.add(new winston.transports.Console({
    format: winston.format.combine(
        winston.format.timestamp(),
        process.env.NODE_ENV === 'production'
            ? winston.format.json()
            : winston.format.printf(({ level, message, timestamp }) => {
                return `[${timestamp}] ${level}: ${message}`;
            })
    ),
}));

// Errors logged together with an Error object go to Sentry as well (a no-op
// without SENTRY_DSN). Plain error messages stay in the log only.
const SPLAT = Symbol.for('splat');
class ErrorReportingTransport extends winston.Transport {
    log(info, callback) {
        const err = findError([...(info[SPLAT] || []), info]);
        if (err) reportError(err, { context: typeof info.message === 'string' ? info.message : undefined });
        callback();
    }
}
logger.add(new ErrorReportingTransport({ level: 'error' }));

module.exports = logger;
