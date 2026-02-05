const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth'); // Will create this later or move from server.js

router.post('/register', authController.register);
router.post('/verify', authController.verify);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
