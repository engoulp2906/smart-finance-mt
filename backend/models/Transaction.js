const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    transactionDate: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    rawDescription: {
      type: String,
      required: true,
    },
    predictedCategory: {
      type: String,
      default: '',
    },
    confidenceScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);