const express = require('express');
const { requireAdmin } = require('../middleware/auth');

const createProfileRoutes = ({ cache, authenticateToken, requireOwnership, profileHandlers }) => {
  const router = express.Router();

  router.get('/leaderboard', cache(60), profileHandlers.getLeaderboard);
  router.get(
    '/achievements/:userId',
    authenticateToken,
    requireOwnership('userId'),
    profileHandlers.getAchievements
  );
  router.put(
    '/users/:id',
    authenticateToken,
    // Ownership permits profile edits, never client-authored game/reward statistics.
    requireAdmin,
    requireOwnership('id'),
    profileHandlers.updateUserStats
  );
  router.patch(
    '/users/:id/profile',
    authenticateToken,
    requireOwnership('id'),
    profileHandlers.updateUserProfile
  );

  return router;
};

module.exports = { createProfileRoutes };
