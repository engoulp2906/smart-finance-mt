const express = require('express');
const { getAlerts } = require('../controllers/alert');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, getAlerts);

module.exports = router;
