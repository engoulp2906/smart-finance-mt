const express = require('express');
const { linkBill, getLinkedBills } = require('../controllers/bbps');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/link', authenticateToken, linkBill);
router.get('/linked', authenticateToken, getLinkedBills);

module.exports = router;