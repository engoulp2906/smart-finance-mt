const express = require('express');
const {
	upload,
	createTransaction,
	uploadTransactions,
	getSummary,
	getRecentTransactions,
	getAllTransactions,
	getSmartBudgetInsights,
} = require('../controllers/transaction');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/', createTransaction);
router.post('/upload', upload.single('file'), uploadTransactions);
router.get('/summary', getSummary);
router.get('/recent', authenticateToken, getRecentTransactions);
router.get('/all', authenticateToken, getAllTransactions);
router.get('/insights', authenticateToken, getSmartBudgetInsights);

module.exports = router;