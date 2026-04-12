const Alert = require('../models/Alert');
const LinkedBill = require('../models/LinkedBill');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

const formatAmount = (value) => Number(value || 0).toLocaleString('en-IN');

const runFinancialAudit = async (userId) => {
  try {
    if (!userId) {
      return true;
    }

    const user = await User.findOne({
      $or: [
        { _id: userId },
        { userId: String(userId) },
      ],
    });

    if (!user) {
      return true;
    }

    const transactionUserId = user.userId || String(user._id);
    const alertUserId = String(user._id);

    await Alert.deleteMany({ userId: alertUserId });

    const alertsToCreate = [];

    const linkedBills = await LinkedBill.find({ userId: transactionUserId });

  linkedBills.forEach((bill) => {
    if (bill.isAutoPay === true && bill.status === 'Paid') {
      alertsToCreate.push({
        userId: alertUserId,
        type: 'SUCCESS',
        title: 'Auto-Pay Successful',
        message: `Auto-Pay Successful: ${bill.billerType} bill paid.`,
        color: 'green',
        createdAt: new Date(),
      });
    }

    if (bill.isAutoPay === false && bill.status === 'Pending') {
      alertsToCreate.push({
        userId: alertUserId,
        type: 'WARNING',
        title: 'Upcoming Bill',
        message: `Upcoming Bill: ${bill.billerType} manual payment required.`,
        color: 'yellow',
        createdAt: new Date(),
      });
    }
  });

    const budgets = await Budget.find({ userId: transactionUserId });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    for (const budget of budgets) {
      const expenses = await Transaction.aggregate([
        {
          $match: {
            userId: transactionUserId,
            predictedCategory: { $regex: new RegExp('^' + budget.category + '$', 'i') },
            amount: { $lt: 0 },
            transactionDate: { $gte: startOfMonth, $lt: startOfNextMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      const spent = expenses.length > 0 ? Math.abs(Number(expenses[0].total || 0)) : 0;
      const limit = Number(budget.limit || 0);

      if (spent > limit) {
        alertsToCreate.push({
          userId: alertUserId,
          type: 'CRITICAL',
          title: `Budget Exceeded: ${budget.category}`,
          message: `${budget.category}: You spent ₹${formatAmount(spent)}. Limit is ₹${formatAmount(limit)}.`,
          color: 'red',
          createdAt: new Date(),
        });
      } else if (spent >= limit * 0.9) {
        alertsToCreate.push({
          userId: alertUserId,
          type: 'SYSTEM',
          title: 'Nightly Audit',
          message: `Nightly Audit: ${budget.category} budget at critical capacity (>90%).`,
          color: 'purple',
          createdAt: new Date(),
        });
      }
    }

    const expenseTransactions = await Transaction.find({ userId: transactionUserId, amount: { $lt: 0 } });

    const bankTransfers = await Transaction.find({
      userId: transactionUserId,
      predictedCategory: 'Bank Transfer',
      amount: { $gt: 0 },
    });

    const totalIncome = bankTransfers.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const wantsLimit = totalIncome * 0.3;

    const wantsSpent = expenseTransactions
      .filter((transaction) => ['Food', 'Shopping'].includes(transaction.predictedCategory))
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);

    if (Math.abs(wantsSpent) > wantsLimit) {
      alertsToCreate.push({
        userId: alertUserId,
        type: 'AI_INSIGHT',
        title: 'AI Insight',
        message: '50/30/20 Rule Broken: Wants budget exceeded.',
        color: 'red',
        createdAt: new Date(),
      });
    }

    if (alertsToCreate.length > 0) {
      await Alert.insertMany(alertsToCreate);
    }

    return true;
  } catch (error) {
    console.error('[AUDIT SERVICE] Financial audit failed:', error.message);
    return false;
  }
};

module.exports = {
  runFinancialAudit,
};
