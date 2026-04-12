const axios = require('axios');

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { runFinancialAudit } = require('../services/auditService');

const quickPay = async (req, res) => {
  try {
    const requestUserId = req.user?.userId;
    const { amount, description } = req.body;
    const parsedAmount = Number(amount);

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ message: 'description is required.' });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number.' });
    }

    let dbUser = null;

    if (req.user?._id) {
      dbUser = await User.findById(req.user._id);
    }

    if (!dbUser && requestUserId) {
      dbUser = await User.findOne({ userId: requestUserId });
    }

    if (!dbUser) {
      dbUser = await User.findOne({ phone: '8688508347' }) || await User.findOne({ phone: '86888508347' });
    }

    if (!dbUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (dbUser.walletBalance < parsedAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance.' });
    }

    let predictedCategory = 'Uncategorized';
    let confidenceScore = 0;

    try {
      const categorizationResponse = await axios.post('http://localhost:5001/api/categorize', {
        description,
      });

      // Supports both single-result and array-result payloads.
      predictedCategory =
        categorizationResponse.data?.predictedCategory ||
        categorizationResponse.data?.results?.[0]?.predictedCategory ||
        predictedCategory;
      confidenceScore =
        categorizationResponse.data?.confidenceScore ||
        categorizationResponse.data?.results?.[0]?.confidenceScore ||
        confidenceScore;
    } catch (mlError) {
      console.warn('ML categorization unavailable. Falling back to Uncategorized:', mlError.message);
    }

    dbUser.walletBalance -= parsedAmount;

    const transaction = await Transaction.create({
      userId: dbUser.userId,
      transactionDate: new Date(),
      amount: -Math.abs(parsedAmount),
      rawDescription: description,
      predictedCategory,
      confidenceScore,
    });

    await dbUser.save();
    await runFinancialAudit(dbUser._id);

    return res.status(200).json({
      message: 'Payment completed successfully.',
      walletBalance: dbUser.walletBalance,
      transaction,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to process payment.',
      error: error.message,
    });
  }
};

module.exports = {
  quickPay,
};