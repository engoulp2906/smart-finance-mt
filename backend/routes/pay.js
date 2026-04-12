const express = require('express');
const { quickPay } = require('../controllers/pay');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticateToken, quickPay);

module.exports = router;