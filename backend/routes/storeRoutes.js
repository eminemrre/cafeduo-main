const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { authenticateToken } = require('../middleware/auth');

// Public route for items
router.get('/items', storeController.getItems);

// Protected routes for inventory and buying
router.get('/inventory', authenticateToken, storeController.getInventory);
router.post('/buy', authenticateToken, storeController.buyItem);

module.exports = router;
