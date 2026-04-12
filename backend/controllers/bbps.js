const LinkedBill = require('../models/LinkedBill');

const getRequestedUserId = (req) => req.user?.userId || req.query.userId || req.body.userId || 'demo-user';

const billerAmountMap = {
  electricity: 850,
  water: 240,
  broadband: 999,
  gas: 620,
  dth: 430,
  default: 499,
};

const resolveMockBillAmount = (billerType) => {
  const normalized = String(billerType || '').toLowerCase();

  if (normalized.includes('electric')) return billerAmountMap.electricity;
  if (normalized.includes('water')) return billerAmountMap.water;
  if (normalized.includes('broadband') || normalized.includes('internet')) return billerAmountMap.broadband;
  if (normalized.includes('gas')) return billerAmountMap.gas;
  if (normalized.includes('dth') || normalized.includes('tv')) return billerAmountMap.dth;

  return billerAmountMap.default;
};

const linkBill = async (req, res) => {
  try {
    const userId = String(getRequestedUserId(req));
    const { billerType, canNumber, isAutoPay, autoPayDay } = req.body;
    const parsedAutoPayDay = Number(autoPayDay);

    if (!billerType || !canNumber) {
      return res.status(400).json({ message: 'billerType and canNumber are required.' });
    }

    const isRentalBiller = String(billerType).toLowerCase().includes('rental');
    const shouldValidateAutoPayDay = Boolean(isAutoPay) && isRentalBiller;

    if (
      shouldValidateAutoPayDay &&
      (!Number.isInteger(parsedAutoPayDay) || parsedAutoPayDay < 1 || parsedAutoPayDay > 28)
    ) {
      return res.status(400).json({ message: 'autoPayDay must be an integer between 1 and 28 for Rental Bill.' });
    }

    const linkedBill = await LinkedBill.create({
      userId,
      billerType,
      canNumber,
      isAutoPay: Boolean(isAutoPay),
      autoPayDay: shouldValidateAutoPayDay ? parsedAutoPayDay : null,
      mockBillAmount: resolveMockBillAmount(billerType),
    });

    return res.status(201).json({
      message: 'Bill linked successfully.',
      linkedBill,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to link bill.',
      error: error.message,
    });
  }
};

const getLinkedBills = async (req, res) => {
  try {
    const userId = String(getRequestedUserId(req));

    const linkedBills = await LinkedBill.find({ userId }).sort({ createdAt: -1 });

    return res.status(200).json({
      linkedBills,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load linked bills.',
      error: error.message,
    });
  }
};

module.exports = {
  linkBill,
  getLinkedBills,
};