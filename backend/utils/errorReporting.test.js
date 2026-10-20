jest.mock('@sentry/node', () => {
  const scope = { setTag: jest.fn() };
  return {
    isInitialized: jest.fn(() => true),
    captureException: jest.fn(),
    withScope: jest.fn((callback) => callback(scope)),
    __scope: scope,
  };
});

const Sentry = require('@sentry/node');
const { findError, reportError } = require('./errorReporting');
const logger = require('./logger');
const { sendApiError } = require('./routeHelpers');

describe('error reporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Sentry.isInitialized.mockReturnValue(true);
  });

  it('finds the Error a log call was given, directly or inside its metadata', () => {
    const err = new Error('boom');
    expect(findError(['text', err])).toBe(err);
    expect(findError([{ reason: err, promise: {} }])).toBe(err);
    expect(findError([{ error: err }])).toBe(err);
    expect(findError(['text', { code: 'X' }])).toBeNull();
  });

  it('sends the error with where it happened', () => {
    const err = new Error('boom');
    reportError(err, { context: 'checkIn error', requestId: 'req-1' });
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
    expect(Sentry.__scope.setTag).toHaveBeenCalledWith('context', 'checkIn error');
    expect(Sentry.__scope.setTag).toHaveBeenCalledWith('request_id', 'req-1');
  });

  it('does nothing without a DSN or without an Error', () => {
    Sentry.isInitialized.mockReturnValue(false);
    reportError(new Error('boom'));
    Sentry.isInitialized.mockReturnValue(true);
    reportError('not an error');
    reportError(undefined);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('reports errors logged with logger.error, but not plain messages', async () => {
    const err = new Error('db down');
    logger.error('updateLocation error:', err);
    logger.error('Origin not allowed');
    await new Promise((resolve) => setImmediate(resolve));
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  it('reports the error behind a generic 5xx answer', () => {
    const res = {
      req: { requestId: 'req-9' },
      status: jest.fn(function status() {
        return this;
      }),
      json: jest.fn(),
    };
    const err = new Error('relation does not exist');
    sendApiError(res, { error: jest.fn() }, 'Profile save error', err, 'Profil kaydedilemedi.');
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
    expect(Sentry.__scope.setTag).toHaveBeenCalledWith('context', 'Profile save error');
  });
});
