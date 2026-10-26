/**
 * GET /api/test/emails?to= — the captured e-mails of one address, for E2E.
 * Exists only when EMAIL_CAPTURE=true and NODE_ENV is not production; in
 * production the route is never registered.
 */
const express = require('express');

const createTestEmailRoutes = ({
  env = process.env,
  capturedEmails = require('../services/emailService').capturedEmails,
} = {}) => {
  const enabled =
    String(env.EMAIL_CAPTURE || '').trim().toLowerCase() === 'true' && env.NODE_ENV !== 'production';
  if (!enabled) return null;
  const router = express.Router();
  router.get('/api/test/emails', (req, res) => {
    const to = String(req.query?.to || '').trim().toLowerCase();
    res.json({ emails: to ? capturedEmails(to) : [] });
  });
  return router;
};

module.exports = { createTestEmailRoutes };
