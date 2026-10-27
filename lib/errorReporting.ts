import * as Sentry from '@sentry/react';
import { getViteEnvVar } from './viteEnv';

export const initializeErrorReporting = (): void => {
  const dsn = getViteEnvVar('VITE_SENTRY_DSN');
  if (!dsn) return;
  const environment = getViteEnvVar('MODE') || 'development';
  Sentry.init({
    dsn,
    environment,
    // Keep error handlers, but never install screen recording, browser traces or
    // release-health session tracking, even if an SDK update makes them defaults.
    integrations: (defaults) =>
      defaults.filter(
        (integration) => !['Replay', 'BrowserTracing', 'BrowserSession'].includes(integration.name)
      ),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
};
