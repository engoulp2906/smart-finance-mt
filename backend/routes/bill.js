const express = require('express');
const { upload, uploadBill, getPendingBills, payBill } = require('../controllers/bill');

const router = express.Router();

router.post('/upload', upload.single('file'), uploadBill);
router.get('/pending', getPendingBills);
router.post('/pay', payBill);

module.exports = router;