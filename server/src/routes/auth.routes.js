const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', authController.me);

// Example protected route (for future use):
// router.get('/auth/portal-data', requireAuth, (req, res) => { ... });

module.exports = router;
