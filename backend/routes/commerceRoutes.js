const express = require('express');
const { requireCafeAdmin, requireOwnership } = require('../middleware/auth');

const createCommerceRoutes = ({ authenticateToken, cache, commerceHandlers }) => {
  const router = express.Router();

  router.post('/rewards', authenticateToken, requireCafeAdmin, commerceHandlers.createReward);
  router.get('/rewards', cache(600), commerceHandlers.getRewards);
  router.delete('/rewards/:id', authenticateToken, requireCafeAdmin, commerceHandlers.deleteReward);

  router.post('/shop/buy', authenticateToken, commerceHandlers.buyShopItem);
  router.get('/users/:id/items', authenticateToken, requireOwnership('id'), commerceHandlers.getUserItems);
  router.post('/coupons/use', authenticateToken, requireCafeAdmin, commerceHandlers.useCoupon);
  router.get('/shop/inventory/:userId', authenticateToken, requireOwnership('userId'), commerceHandlers.getShopInventory);

  return router;
};

module.exports = { createCommerceRoutes };
