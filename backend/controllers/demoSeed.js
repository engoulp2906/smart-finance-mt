const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const LinkedBill = require('../models/LinkedBill');
const Budget = require('../models/Budget');
const Alert = require('../models/Alert');
const { runFinancialAudit } = require('../services/auditService');

const seedDemoDatabase = async (req, res) => {
  try {
    const demoPhone = '8688508347';
    const demoPassword = '123';
    const demoName = 'Venkata Manoj Kumar';
    const demoWalletBalance = 36000;
    const legacyDemoPhones = ['9746376214', '86888508347'];

    const legacyDemoUsers = await User.find({
      $or: [
        { phone: { $in: legacyDemoPhones } },
        { userId: { $regex: '^demo_user_' } },
      ],
    });

    if (legacyDemoUsers.length) {
      const legacyUserIds = legacyDemoUsers.map((legacyUser) => legacyUser.userId);
      await Promise.all([
        Transaction.deleteMany({ userId: { $in: legacyUserIds } }),
        Budget.deleteMany({ userId: { $in: legacyUserIds } }),
        Alert.deleteMany({ userId: { $in: legacyUserIds } }),
        LinkedBill.deleteMany({ userId: { $in: legacyUserIds } }),
        User.deleteMany({ userId: { $in: legacyUserIds } }),
      ]);
    }

    const hashedPassword = await bcrypt.hash(demoPassword, 10);

    let demoUser = await User.findOne({ phone: demoPhone });

    if (!demoUser) {
      demoUser = await User.create({
        userId: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: demoName,
        phone: demoPhone,
        password: hashedPassword,
        walletBalance: demoWalletBalance,
      });
    } else {
      demoUser.name = demoName;
      demoUser.password = hashedPassword;
    }

    const userId = demoUser.userId;
    await Promise.all([
      Transaction.deleteMany({ userId }),
      Budget.deleteMany({ userId }),
      Alert.deleteMany({ userId }),
      LinkedBill.deleteMany({ userId }),
    ]);

    await Alert.deleteMany({ userId: demoUser._id });

    demoUser.walletBalance = demoWalletBalance;
    await demoUser.save();

    const baseDate = new Date();
    baseDate.setHours(9, 0, 0, 0);

    const atMinute = (offset) => new Date(baseDate.getTime() + offset * 60 * 1000);

    const budgetsData = [
      {
        userId,
        category: 'Shopping',
        limit: 10000,
      },
      {
        userId,
        category: 'Food',
        limit: 8000,
      },
      {
        userId,
        category: 'Transport',
        limit: 5000,
      },
    ];

    const transactionsData = [
      {
        userId,
        transactionDate: atMinute(0),
        amount: 80000,
        rawDescription: 'TechCorp Monthly Salary',
        predictedCategory: 'Bank Transfer',
        confidenceScore: 1.0,
      },
      {
        userId,
        transactionDate: atMinute(5),
        amount: -25000,
        rawDescription: 'VIT Semester Fee Installment',
        predictedCategory: 'Education/Special',
        confidenceScore: 1.0,
      },
      {
        userId,
        transactionDate: atMinute(10),
        amount: -11500,
        rawDescription: 'New Smartphone',
        predictedCategory: 'Shopping',
        confidenceScore: 1.0,
      },
      {
        userId,
        transactionDate: atMinute(15),
        amount: -4500,
        rawDescription: 'Groceries from Reliance Smart',
        predictedCategory: 'Food',
        confidenceScore: 1.0,
      },
      {
        userId,
        transactionDate: atMinute(20),
        amount: -1200,
        rawDescription: 'Uber rides and Metro',
        predictedCategory: 'Transport',
        confidenceScore: 1.0,
      },
      {
        userId,
        transactionDate: atMinute(25),
        amount: -1800,
        rawDescription: 'Electricity Auto-Pay',
        predictedCategory: 'Utilities',
        confidenceScore: 1.0,
      },
    ];

    const linkedBillsData = [
      {
        userId,
        billerType: 'Electricity',
        canNumber: 'ELE-12345',
        isAutoPay: true,
        status: 'Paid',
        mockBillAmount: 1800,
      },
      {
        userId,
        billerType: 'Internet',
        canNumber: 'INT-98765',
        isAutoPay: false,
        status: 'Pending',
        mockBillAmount: 1200,
      },
    ];

    await Promise.all([
      Budget.insertMany(budgetsData),
      Transaction.insertMany(transactionsData),
      LinkedBill.insertMany(linkedBillsData),
    ]);

    await runFinancialAudit(demoUser._id);

    return res.status(200).json({
      message: 'Perfect Demo State Initialized!',
      user: {
        userId: demoUser.userId,
        name: demoUser.name,
        phone: demoUser.phone,
        walletBalance: demoUser.walletBalance,
      },
      seededData: {
        transactions: transactionsData.length,
        linkedBills: linkedBillsData.length,
        budgets: budgetsData.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to seed demo database.',
      error: error.message,
    });
  }
};

module.exports = {
  seedDemoDatabase,
};
