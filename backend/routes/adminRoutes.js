const express = require('express');
const { requireAdmin } = require('../middleware/auth');

const createAdminRoutes = ({ authenticateToken, adminHandlers }) => {
  const router = express.Router();

  router.get('/users', authenticateToken, requireAdmin, adminHandlers.getUsers);
  router.post('/users', authenticateToken, requireAdmin, adminHandlers.createUser);
  router.get('/games', authenticateToken, requireAdmin, adminHandlers.getGames);
  router.put('/users/:id/role', authenticateToken, requireAdmin, adminHandlers.updateUserRole);
  router.patch('/users/:id/points', authenticateToken, requireAdmin, adminHandlers.updateUserPoints);
  router.put('/cafes/:id', authenticateToken, requireAdmin, adminHandlers.updateCafe);
  router.post('/cafes', authenticateToken, requireAdmin, adminHandlers.createCafe);
  router.delete('/cafes/:id', authenticateToken, requireAdmin, adminHandlers.deleteCafe);
  router.post('/cafe-admins', authenticateToken, requireAdmin, adminHandlers.createCafeAdmin);
  router.delete('/users/:id', authenticateToken, requireAdmin, adminHandlers.deleteUser);

  return router;
};

module.exports = { createAdminRoutes };
