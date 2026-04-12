const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { setBudget, getBudgets } = require('../controllers/budget');

const router = express.Router();

router.post('/', authenticateToken, setBudget);
router.get('/', authenticateToken, getBudgets);

module.exports = router;