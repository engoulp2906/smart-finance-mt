const User = require('../models/User');
const Transaction = require('../models/Transaction');

const getRequestedUserId = (req) => req.query.userId || req.body.userId || 'demo-user';

const getOrCreateUser = async (userId) => {
  let user = await User.findOne({ userId });
  if (!user) {
    user = await User.create({ userId, walletBalance: 0 });
  }

  return user;
};

const getWalletBalance = async (req, res) => {
  try {
    const userId = String(getRequestedUserId(req));
    const user = await getOrCreateUser(userId);

    return res.status(200).json({
      userId: user.userId,
      walletBalance: user.walletBalance,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch wallet balance.',
      error: error.message,
    });
  }
};

const addFunds = async (req, res) => {
  try {
    const userId = String(getRequestedUserId(req));
    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number.' });
    }

    const user = await getOrCreateUser(userId);
    user.walletBalance += amount;

    const transaction = await Transaction.create({
      userId: user.userId,
      transactionDate: new Date(),
      amount,
      rawDescription: 'Bank Deposit',
      predictedCategory: 'Bank Transfer',
      confidenceScore: 1,
    });

    await user.save();

    return res.status(200).json({
      message: 'Funds added successfully.',
      userId: user.userId,
      walletBalance: user.walletBalance,
      transaction,
      linkedBankSimulation: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to add funds.',
      error: error.message,
    });
  }
};

module.exports = {
  getWalletBalance,
  addFunds,
};