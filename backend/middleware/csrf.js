/**
 * CSRF (Cross-Site Request Forgery) Protection Middleware
 *
 * Implements Double Submit Cookie Pattern for CSRF protection.
 * Works with httpOnly cookie-based JWT authentication.
 *
 * SECURITY NOTES:
 * - sameSite: 'lax' already blocks most CSRF vectors (cross-site POST)
 * - This adds an additional security layer with synchronizer token pattern
 * - CSRF token is stored in a non-httpOnly cookie (readable by JS)
 * - Frontend must send the token in X-CSRF-Token header
 * - Safe methods (GET, HEAD, OPTIONS) are exempt from CSRF check
 * - Auth endpoints (login, register, google-login) are exempt (no token before login)
 *
 * Usage:
 *   const csrfMiddleware = require('./middleware/csrf');
 *   app.use(csrfMiddleware);
 *
 *   In auth controller (after successful login):
 *   res.cookie('csrf_token', generateCsrfToken(), csrfCookieOptions());
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// CSRF Configuration
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32; // bytes (64 hex chars)

// Safe HTTP methods that don't require CSRF protection
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Paths that are exempt from CSRF check (before login or public endpoints)
const EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/meta/version',
  '/health',
]);

/**
 * Generate a cryptographically secure random CSRF token
 * @returns {string} 64-character hex string
 */
function generateCsrfToken() {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Get CSRF cookie options
 * @returns {object} Cookie options for res.cookie()
 */
function csrfCookieOptions() {
  return {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

/**
 * Clear CSRF cookie
 * @param {object} res - Express response object
 */
function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

/**
 * Set CSRF cookie (typically after successful login)
 * @param {object} res - Express response object
 * @returns {string} The generated CSRF token
 */
function setCsrfCookie(res) {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions());
  return token;
}

/**
 * CSRF Protection Middleware
 *
 * Validates CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
 * Safe methods (GET, HEAD, OPTIONS) bypass CSRF check
 * Exempt paths bypass CSRF check
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
function csrfMiddleware(req, res, next) {
  // Bypass CSRF check for safe methods
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Bypass CSRF check for exempt paths
  if (EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  // Get CSRF token from cookie
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  
  // Get CSRF token from header
  const headerToken = req.headers?.[CSRF_HEADER_NAME];

  // Validate CSRF token
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    logger.warn('CSRF token validation failed', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      hasCookieToken: !!cookieToken,
      hasHeaderToken: !!headerToken,
      tokensMatch: cookieToken === headerToken,
    });

    return res.status(403).json({
      error: 'CSRF token validation failed',
      code: 'CSRF_TOKEN_INVALID',
      message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
    });
  }

  // CSRF token is valid, proceed to next middleware
  next();
}

/**
 * CSRF Token Endpoint Handler
 * Returns a fresh CSRF token (for clients that need to refresh)
 * This endpoint is exempt from CSRF check and can be called before login
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
function getCsrfToken(req, res) {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions());
  res.json({ csrfToken: token });
}

module.exports = {
  csrfMiddleware,
  generateCsrfToken,
  setCsrfCookie,
  clearCsrfCookie,
  csrfCookieOptions,
  getCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
};
