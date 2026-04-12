const express = require('express');
const { payBill } = require('../controllers/demo');
const { seedDemoDatabase } = require('../controllers/demoSeed');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/pay-bill', authenticateToken, payBill);
router.post('/seed', seedDemoDatabase);

module.exports = router;