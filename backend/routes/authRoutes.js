const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { buildRateLimiterOptions } = require('../middleware/rateLimit');
const { authenticateToken } = require('../middleware/auth'); // Will create this later or move from server.js

const AUTH_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const AUTH_LOGIN_MAX_ATTEMPTS = Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS || 20);
const AUTH_REGISTER_MAX_ATTEMPTS = Number(process.env.AUTH_REGISTER_RATE_LIMIT_MAX_REQUESTS || 10);
const AUTH_GOOGLE_MAX_ATTEMPTS = Number(process.env.AUTH_GOOGLE_RATE_LIMIT_MAX_REQUESTS || 30);
const AUTH_FORGOT_PASSWORD_MAX_ATTEMPTS = Number(process.env.AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX_REQUESTS || 6);
const AUTH_RESET_PASSWORD_MAX_ATTEMPTS = Number(process.env.AUTH_RESET_PASSWORD_RATE_LIMIT_MAX_REQUESTS || 12);

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

const googleLimiter = buildAuthLimiter(
  'auth:google',
  AUTH_GOOGLE_MAX_ATTEMPTS,
  'Çok fazla Google giriş denemesi. Lütfen biraz bekleyip tekrar deneyin.',
  'AUTH_GOOGLE_RATE_LIMITED'
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

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authenticateToken, authController.logout);
router.post('/google', googleLimiter, authController.googleLogin);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);
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
