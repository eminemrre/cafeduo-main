const express = require('express');
const router = express.Router();
const cafeController = require('../controllers/cafeController');
const { authenticateToken, requireCafeAdmin } = require('../middleware/auth');
const { cache } = require('../middleware/cache');

// Public Routes
router.get('/', cache(300), cafeController.getAllCafes); // Cache 5 mins
router.get('/:id', cache(300), cafeController.getCafeById);

// Protected Routes
router.post('/:id/check-in', authenticateToken, cafeController.checkIn);

// Admin Routes
router.put('/:id/pin', authenticateToken, requireCafeAdmin, cafeController.updatePin);

module.exports = router;
