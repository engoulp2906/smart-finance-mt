const express = require('express');
const { getWalletBalance, addFunds } = require('../controllers/wallet');

const router = express.Router();

router.get('/balance', getWalletBalance);
router.post('/add-funds', addFunds);

module.exports = router;