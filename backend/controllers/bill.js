const axios = require('axios');
const multer = require('multer');

const Bill = require('../models/Bill');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const upload = multer({ storage: multer.memoryStorage() });

const getRequestedUserId = (req) => req.query.userId || req.body.userId || 'demo-user';

const getOrCreateUser = async (userId) => {
  let user = await User.findOne({ userId });
  if (!user) {
    user = await User.create({ userId, walletBalance: 0 });
  }

  return user;
};

const uploadBill = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Bill file is required.' });
    }

    const userId = String(getRequestedUserId(req));

    // Prototype OCR simulation from the uploaded file.
    const extractedBillData = {
      billerName: 'City Water',
      amount: 45.0,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    const bill = await Bill.create({
      userId,
      billerName: extractedBillData.billerName,
      amount: extractedBillData.amount,
      dueDate: extractedBillData.dueDate,
      isPaid: false,
    });

    return res.status(201).json({
      message: 'Bill uploaded and OCR simulated successfully.',
      extractedBillData,
      bill,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to upload bill.',
      error: error.message,
    });
  }
};

const getPendingBills = async (req, res) => {
  try {
    const userId = String(getRequestedUserId(req));
    const pendingBills = await Bill.find({ userId, isPaid: false }).sort({ dueDate: 1 });

    return res.status(200).json({
      userId,
      pendingBills,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch pending bills.',
      error: error.message,
    });
  }
};

const payBill = async (req, res) => {
  try {
    const userId = String(getRequestedUserId(req));
    const { billId } = req.body;

    if (!billId) {
      return res.status(400).json({ message: 'billId is required.' });
    }

    const bill = await Bill.findOne({ _id: billId, userId });
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found for this user.' });
    }

    if (bill.isPaid) {
      return res.status(400).json({ message: 'Bill is already paid.' });
    }

    const user = await getOrCreateUser(userId);
    if (user.walletBalance < bill.amount) {
      return res.status(400).json({
        message: 'Insufficient wallet balance.',
        walletBalance: user.walletBalance,
      });
    }

    user.walletBalance -= bill.amount;
    bill.isPaid = true;

    const description = `Bill payment: ${bill.billerName}`;
    let predictedCategory = 'Bills';
    let confidenceScore = 0;

    try {
      const categorizationResponse = await axios.post('http://localhost:5001/api/categorize', {
        transactions: [description],
      });

      const firstResult = categorizationResponse.data?.results?.[0];
      predictedCategory = firstResult?.predictedCategory || predictedCategory;
      confidenceScore = firstResult?.confidenceScore || 0;
    } catch (mlError) {
      console.warn('ML categorization unavailable. Falling back to Bills category:', mlError.message);
    }

    const transaction = await Transaction.create({
      userId,
      transactionDate: new Date(),
      amount: bill.amount,
      rawDescription: description,
      predictedCategory,
      confidenceScore,
    });

    await Promise.all([user.save(), bill.save()]);

    return res.status(200).json({
      message: 'Bill paid successfully.',
      walletBalance: user.walletBalance,
      bill,
      transaction,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to pay bill.',
      error: error.message,
    });
  }
};

module.exports = {
  upload,
  uploadBill,
  getPendingBills,
  payBill,
};