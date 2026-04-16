const express = require('express');

const createProfileRoutes = ({
  cache,
  authenticateToken,
  requireOwnership,
  profileHandlers,
}) => {
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
    requireOwnership('id'),
    profileHandlers.updateUserStats
  );

  return router;
};

module.exports = { createProfileRoutes };
