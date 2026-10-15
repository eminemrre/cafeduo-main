const cookieParser = require('cookie-parser');
const { hasValidCsrfToken } = require('./csrf');
const authController = require('../controllers/authController');

// This runs before the generic API limiter, without bypassing it.
// Invalid/missing CSRF proceeds to the usual rate-limit and CSRF error path.
const prepareLogout = [
  cookieParser(),
  (req, res, next) => {
    if (!hasValidCsrfToken(req)) return next();
    return authController.clearLogoutCookies(req, res, next);
  },
];

module.exports = { prepareLogout };
