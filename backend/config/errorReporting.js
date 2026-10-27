const { sanitizeDiagnosticData } = require('../../shared/diagnosticPrivacy');

const createServerErrorReportingOptions = ({ dsn, environment, release }) => ({
  dsn,
  environment,
  release,
  sendDefaultPii: false,
  tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
  initialScope: { tags: { service: 'api' } },
  // Redis keys currently include bearer tokens and rate-limit IPs. Never collect
  // their command arguments; keep the send-time DB scrubber as defence in depth.
  integrations: (defaults) => defaults.filter((integration) => integration.name !== 'Redis'),
  // Error hooks do not run for transactions. Protect both, and individual spans.
  beforeSend: sanitizeDiagnosticData,
  beforeSendTransaction: sanitizeDiagnosticData,
  beforeSendSpan: sanitizeDiagnosticData,
  beforeBreadcrumb: sanitizeDiagnosticData,
});

module.exports = { createServerErrorReportingOptions };
