import * as Sentry from '@sentry/react';
import { initializeErrorReporting } from './errorReporting';
import { getViteEnvVar } from './viteEnv';

jest.mock('@sentry/react', () => ({
  init: jest.fn(),
  replayIntegration: jest.fn(() => {
    throw new Error('Session recording must not be installed');
  }),
  browserTracingIntegration: jest.fn(() => {
    throw new Error('Browser tracing must not be installed');
  }),
}));
jest.mock('./viteEnv', () => ({ getViteEnvVar: jest.fn() }));

describe('error-only browser reporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getViteEnvVar as jest.Mock).mockImplementation(
      (key: string) =>
        (
          ({ VITE_SENTRY_DSN: 'https://public@example.com/1', MODE: 'production' }) as Record<
            string,
            string
          >
        )[key] || ''
    );
  });

  it('keeps error reporting without installing replay or browser tracing', () => {
    initializeErrorReporting();
    const options = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(options).toEqual(
      expect.objectContaining({
        dsn: 'https://public@example.com/1',
        environment: 'production',
        sendDefaultPii: false,
        tracesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
      })
    );
    const defaults = [
      'GlobalHandlers',
      'Breadcrumbs',
      'BrowserSession',
      'Replay',
      'BrowserTracing',
    ].map((name) => ({ name }));
    expect(options.integrations(defaults)).toEqual([
      { name: 'GlobalHandlers' },
      { name: 'Breadcrumbs' },
    ]);
    expect(Sentry.replayIntegration).not.toHaveBeenCalled();
    expect(Sentry.browserTracingIntegration).not.toHaveBeenCalled();
  });

  it('does not initialize any reporting when no DSN is configured', () => {
    (getViteEnvVar as jest.Mock).mockReturnValue('');
    initializeErrorReporting();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('preserves error details while removing the existing email and IP user fields', () => {
    initializeErrorReporting();
    const options = (Sentry.init as jest.Mock).mock.calls[0][0];
    const event = {
      message: 'A real application error',
      user: { id: '7', email: 'private@example.com', ip_address: '192.0.2.1' },
    };
    expect(options.beforeSend(event, {})).toEqual({
      message: 'A real application error',
      user: { id: '7' },
    });
    expect(options.beforeSend({ message: 'No user context' }, {})).toEqual({
      message: 'No user context',
    });
  });
});
