const User = require('../models/User');
const Transaction = require('../models/Transaction');

const payBill = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { amount, purpose } = req.body;
    const parsedAmount = Number(amount);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized user context.' });
    }

    if (!purpose || typeof purpose !== 'string') {
      return res.status(400).json({ message: 'purpose is required.' });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number.' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.walletBalance < parsedAmount) {
      return res.status(400).json({
        message: 'Insufficient wallet balance.',
        walletBalance: user.walletBalance,
      });
    }

    user.walletBalance -= parsedAmount;

    const transaction = await Transaction.create({
      userId: user.userId,
      transactionDate: new Date(),
      amount: parsedAmount,
      rawDescription: `Quick Pay: ${purpose}`,
      predictedCategory: purpose,
      confidenceScore: 1,
    });

    await user.save();

    return res.status(200).json({
      message: 'Payment completed successfully.',
      walletBalance: user.walletBalance,
      transaction,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to process demo bill payment.',
      error: error.message,
    });
  }
};

module.exports = {
  payBill,
};