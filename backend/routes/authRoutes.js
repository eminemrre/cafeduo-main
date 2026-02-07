const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth'); // Will create this later or move from server.js

const AUTH_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const AUTH_LOGIN_MAX_ATTEMPTS = Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS || 20);
const AUTH_REGISTER_MAX_ATTEMPTS = Number(process.env.AUTH_REGISTER_RATE_LIMIT_MAX_REQUESTS || 10);

const buildAuthLimiter = (max, message, code, skipSuccessfulRequests = false) =>
  rateLimit({
    windowMs: AUTH_WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
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
  });

const loginLimiter = buildAuthLimiter(
  AUTH_LOGIN_MAX_ATTEMPTS,
  'Çok fazla giriş denemesi. Lütfen biraz bekleyip tekrar deneyin.',
  'AUTH_LOGIN_RATE_LIMITED',
  true
);

const registerLimiter = buildAuthLimiter(
  AUTH_REGISTER_MAX_ATTEMPTS,
  'Çok fazla kayıt denemesi. Lütfen biraz bekleyip tekrar deneyin.',
  'AUTH_REGISTER_RATE_LIMITED'
);

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
