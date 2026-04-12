const mongoose = require('mongoose');

const linkedBillSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    billerType: {
      type: String,
      required: true,
      trim: true,
    },
    canNumber: {
      type: String,
      required: true,
      trim: true,
    },
    isAutoPay: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['Paid', 'Pending'],
      default: 'Pending',
    },
    autoPayDay: {
      type: Number,
      min: 1,
      max: 28,
      default: null,
    },
    mockBillAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('LinkedBill', linkedBillSchema);