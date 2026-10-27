const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { buildRateLimiterOptions } = require('../middleware/rateLimit');
const { authenticateToken } = require('../middleware/auth'); // Will create this later or move from server.js

// 🔒 SECURITY: Rate limiting tuned for better UX while maintaining protection
// Window reduced from 15min to 5min to prevent excessive lockout times
const AUTH_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000); // 5 minutes
const AUTH_LOGIN_MAX_ATTEMPTS = Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS || 8);
const AUTH_REGISTER_MAX_ATTEMPTS = Number(process.env.AUTH_REGISTER_RATE_LIMIT_MAX_REQUESTS || 5);
const AUTH_FORGOT_PASSWORD_MAX_ATTEMPTS = Number(
  process.env.AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX_REQUESTS || 3
);
const AUTH_RESET_PASSWORD_MAX_ATTEMPTS = Number(
  process.env.AUTH_RESET_PASSWORD_RATE_LIMIT_MAX_REQUESTS || 6
);

const buildAuthLimiter = (scope, limit, message, code, skipSuccessfulRequests = false) =>
  rateLimit(
    buildRateLimiterOptions({
      scope,
      windowMs: AUTH_WINDOW_MS,
      limit,
      skipSuccessfulRequests,
      handler: (req, res, _next, options) => {
        const retrySeconds = req.rateLimit?.resetTime
          ? Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000))
          : undefined;

        return res.status(options.statusCode).json({
          error: message,
          code,
          retryAfterSeconds: retrySeconds,
        });
      },
    })
  );

const loginLimiter = buildAuthLimiter(
  'auth:login',
  AUTH_LOGIN_MAX_ATTEMPTS,
  'Çok fazla giriş denemesi. Lütfen biraz bekleyip tekrar deneyin.',
  'AUTH_LOGIN_RATE_LIMITED',
  true
);

const registerLimiter = buildAuthLimiter(
  'auth:register',
  AUTH_REGISTER_MAX_ATTEMPTS,
  'Çok fazla kayıt denemesi. Lütfen biraz bekleyip tekrar deneyin.',
  'AUTH_REGISTER_RATE_LIMITED'
);

const forgotPasswordLimiter = buildAuthLimiter(
  'auth:forgot-password',
  AUTH_FORGOT_PASSWORD_MAX_ATTEMPTS,
  'Çok fazla şifre sıfırlama isteği gönderildi. Lütfen biraz bekleyin.',
  'AUTH_FORGOT_PASSWORD_RATE_LIMITED'
);

const resetPasswordLimiter = buildAuthLimiter(
  'auth:reset-password',
  AUTH_RESET_PASSWORD_MAX_ATTEMPTS,
  'Çok fazla şifre güncelleme denemesi yapıldı. Lütfen biraz bekleyin.',
  'AUTH_RESET_PASSWORD_RATE_LIMITED'
);

const verifyEmailLimiter = buildAuthLimiter(
  'auth:verify-email',
  Number(process.env.AUTH_VERIFY_EMAIL_RATE_LIMIT_MAX_REQUESTS || 20),
  'Çok fazla doğrulama denemesi. Lütfen biraz bekleyin.',
  'AUTH_VERIFY_EMAIL_RATE_LIMITED'
);

// Three new verification links per user per hour, whatever IP they come from.
const resendVerificationLimiter = rateLimit(
  buildRateLimiterOptions({
    scope: 'auth:resend-verification',
    windowMs: 60 * 60 * 1000,
    limit: 3,
    keyGenerator: (req) => `user:${req.user?.id ?? 'anonymous'}`,
    handler: (req, res) =>
      res.status(429).json({
        error: 'Doğrulama e-postasını kısa süre içinde çok kez istedin. Biraz sonra yeniden dene.',
        code: 'AUTH_RESEND_VERIFICATION_RATE_LIMITED',
      }),
  })
);

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.clearLogoutCookies, authenticateToken, authController.logout);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);
router.post('/verify-email', verifyEmailLimiter, authController.verifyEmail);
router.post('/accept-terms', authenticateToken, authController.acceptTerms);
router.post(
  '/resend-verification',
  authenticateToken,
  resendVerificationLimiter,
  authController.resendVerification
);
router.get(
  '/me',
  authenticateToken,
  (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  },
  authController.getMe
);

module.exports = router;
