/**
 * Public base URL of the web app for links in e-mails: APP_BASE_URL,
 * PUBLIC_APP_URL, FRONTEND_URL, the first concrete CORS origin, else the
 * local Vite address. No trailing slash.
 */
const resolveAppBaseUrl = () => {
  const corsOrigin = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .find((origin) => Boolean(origin) && origin !== '*');
  return (
    String(
      process.env.APP_BASE_URL ||
        process.env.PUBLIC_APP_URL ||
        process.env.FRONTEND_URL ||
        corsOrigin ||
        'http://localhost:5173'
    )
      .trim()
      .replace(/\/+$/, '') || 'http://localhost:5173'
  );
};

module.exports = { resolveAppBaseUrl };
