const axios = require('axios');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const Transaction = require('../models/Transaction');

const upload = multer({ storage: multer.memoryStorage() });
const dynamoDbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});
const dynamoDbDocumentClient = DynamoDBDocumentClient.from(dynamoDbClient);
const dynamoDbTableName = process.env.DYNAMODB_TABLE_NAME || 'FinanceTransactions';

const parseCsvBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const rows = [];

    Readable.from([buffer])
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

const getFirstPresentValue = (row, keys, fallback = '') => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return fallback;
};

const buildTransactionPayloads = (rows) =>
  rows.map((row) => ({
    userId: String(getFirstPresentValue(row, ['userId', 'UserId', 'user_id'], 'unknown')),
    transactionDate: new Date(
      getFirstPresentValue(row, ['transactionDate', 'date', 'TransactionDate'], new Date().toISOString())
    ),
    amount: Number(getFirstPresentValue(row, ['amount', 'Amount'], 0)),
    rawDescription: String(
      getFirstPresentValue(row, ['rawDescription', 'description', 'Description', 'merchant', 'Merchant'], '')
    ),
  }));

const extractCategorizationResult = (categorizationData) => {
  if (Array.isArray(categorizationData?.results) && categorizationData.results.length > 0) {
    return categorizationData.results[0] || {};
  }

  return categorizationData || {};
};

const saveTransactionToMongo = async (transactionData) => Transaction.create(transactionData);

const saveTransactionToDynamoDb = async (transactionData) => {
  const transactionDate = transactionData.transactionDate instanceof Date
    ? transactionData.transactionDate
    : new Date(transactionData.transactionDate || Date.now());

  await dynamoDbDocumentClient.send(
    new PutCommand({
      TableName: dynamoDbTableName,
      Item: {
        transactionId: transactionData.transactionId,
        amount: transactionData.amount,
        description: transactionData.rawDescription,
        category: transactionData.predictedCategory,
        date: transactionDate.toISOString(),
      },
    })
  );
};

const createTransaction = async (req, res) => {
  try {
    const { amount, description, date, userId: requestUserId } = req.body;
    const parsedAmount = Number(amount);

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ message: 'description is required.' });
    }

    if (!Number.isFinite(parsedAmount)) {
      return res.status(400).json({ message: 'amount must be a valid number.' });
    }

    const transactionDate = date ? new Date(date) : new Date();

    if (Number.isNaN(transactionDate.getTime())) {
      return res.status(400).json({ message: 'date must be a valid date.' });
    }

    let predictedCategory = 'Uncategorized';
    let confidenceScore = 0;

    try {
      const categorizationResponse = await axios.post('http://localhost:5001/api/categorize', {
        transactions: [description],
      });

      const categorizationResult = extractCategorizationResult(categorizationResponse.data);
      predictedCategory = categorizationResult.predictedCategory || predictedCategory;
      confidenceScore = categorizationResult.confidenceScore || confidenceScore;
    } catch (mlError) {
      console.warn('ML categorization unavailable. Falling back to Uncategorized:', mlError.message);
    }

    const transactionPayload = {
      transactionId: Date.now().toString(),
      userId: String(req.user?.userId || requestUserId || 'unknown'),
      transactionDate,
      amount: parsedAmount,
      rawDescription: description,
      predictedCategory,
      confidenceScore,
    };

    let savedTransaction = null;
    let mongoError = null;
    let dynamoError = null;

    try {
      savedTransaction = await saveTransactionToMongo(transactionPayload);
    } catch (error) {
      mongoError = error;
      console.error('MongoDB transaction save failed:', error);
    }

    try {
      await saveTransactionToDynamoDb(transactionPayload);
    } catch (error) {
      dynamoError = error;
      console.error('DynamoDB transaction save failed:', error);
    }

    if (!savedTransaction && mongoError && dynamoError) {
      return res.status(500).json({
        message: 'Failed to save transaction to both databases.',
        mongoError: mongoError.message,
        dynamoError: dynamoError.message,
      });
    }

    return res.status(201).json({
      message: 'Transaction processed successfully.',
      transaction: savedTransaction,
      transactionId: transactionPayload.transactionId,
      mongoSaved: Boolean(savedTransaction),
      dynamoSaved: !dynamoError,
      mongoError: mongoError ? mongoError.message : null,
      dynamoError: dynamoError ? dynamoError.message : null,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to process transaction.',
      error: error.message,
    });
  }
};

const uploadTransactions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }

    const rows = await parseCsvBuffer(req.file.buffer);

    if (!rows.length) {
      return res.status(400).json({ message: 'CSV file did not contain any rows.' });
    }

    const transactionPayloads = buildTransactionPayloads(rows);
    const descriptions = transactionPayloads.map((transaction) => transaction.rawDescription);

    const categorizationResponse = await axios.post('http://localhost:5001/api/categorize', {
      transactions: descriptions,
    });

    const predictions = Array.isArray(categorizationResponse.data?.results)
      ? categorizationResponse.data.results
      : [];

    const documentsToSave = transactionPayloads.map((transaction, index) => {
      const predictedCategory = predictions[index]?.predictedCategory || '';
      const normalizedAmount = predictedCategory === 'Bank Transfer'
        ? Math.abs(Number(transaction.amount || 0))
        : -Math.abs(Number(transaction.amount || 0));

      return {
        ...transaction,
        amount: normalizedAmount,
        predictedCategory,
        confidenceScore: predictions[index]?.confidenceScore || 0,
      };
    });

    const savedTransactions = await Transaction.insertMany(documentsToSave);

    return res.status(200).json({
      message: 'CSV uploaded and sent for categorization.',
      parsedRows: rows,
      savedTransactions,
      categorizedData: categorizationResponse.data,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to process CSV file.',
      error: error.message,
    });
  }
};

const getSummary = async (req, res) => {
  try {
    const summary = await Transaction.aggregate([
      {
        $group: {
          _id: '$predictedCategory',
          totalAmount: { $sum: { $abs: '$amount' } },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $sort: { transactionCount: -1 },
      },
    ]);

    return res.status(200).json({
      summary,
      labels: summary.map((item) => item._id || 'Uncategorized'),
      values: summary.map((item) => item.transactionCount),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load transaction summary.',
      error: error.message,
    });
  }
};

const getRecentTransactions = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized user context.' });
    }

    const transactions = await Transaction.find({ userId })
      .sort({ transactionDate: -1 })
      .limit(10);

    return res.status(200).json({
      transactions,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch recent transactions.',
      error: error.message,
    });
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized user context.' });
    }

    const transactions = await Transaction.find({ userId }).sort({ transactionDate: -1 });

    return res.status(200).json({
      transactions,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch transaction history.',
      error: error.message,
    });
  }
};

const getSmartBudgetInsights = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized user context.' });
    }

    const incomeTransactions = await Transaction.find({
      userId,
      predictedCategory: 'Bank Transfer',
    });

    const summedIncome = incomeTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.amount || 0),
      0
    );

    const totalIncome = summedIncome === 0 ? 1 : summedIncome;
    const needsLimit = totalIncome * 0.5;
    const wantsLimit = totalIncome * 0.3;
    const savingsGoal = totalIncome * 0.2;

    const expenseTransactions = await Transaction.find({
      userId,
      amount: { $lt: 0 },
    });

    const needsCategories = ['Utilities', 'Transport', 'Education/Special'];
    const wantsCategories = ['Shopping', 'Food'];

    const needsSpent = expenseTransactions
      .filter((transaction) => needsCategories.includes(transaction.predictedCategory))
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const wantsSpent = expenseTransactions
      .filter((transaction) => wantsCategories.includes(transaction.predictedCategory))
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const alerts = [];

    if (Math.abs(wantsSpent) > wantsLimit) {
      alerts.push({
        type: 'AI_INSIGHT',
        message: '50/30/20 Rule Broken: You have spent over 30% of your income on Wants. Tone down the shopping!'
      });
    }

    return res.status(200).json({
      totalIncome,
      needsLimit,
      wantsLimit,
      savingsGoal,
      needsSpent,
      wantsSpent,
      alerts,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to calculate 50/30/20 budget insights.',
      error: error.message,
    });
  }
};

module.exports = {
  upload,
  createTransaction,
  getSummary,
  getRecentTransactions,
  getAllTransactions,
  uploadTransactions,
  getSmartBudgetInsights,
};