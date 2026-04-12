const Budget = require('../models/Budget');

const setBudget = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { category, limit } = req.body;
    const parsedLimit = Number(limit);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized user context.' });
    }

    if (!category || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ message: 'category is required.' });
    }

    if (!Number.isFinite(parsedLimit) || parsedLimit < 0) {
      return res.status(400).json({ message: 'limit must be a non-negative number.' });
    }

    const normalizedCategory = category.trim();

    const budget = await Budget.findOneAndUpdate(
      { userId, category: normalizedCategory },
      {
        $set: {
          userId,
          category: normalizedCategory,
          limit: parsedLimit,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      message: 'Budget saved successfully.',
      budget,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to save budget.',
      error: error.message,
    });
  }
};

const getBudgets = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized user context.' });
    }

    const budgets = await Budget.find({ userId }).sort({ category: 1 });

    return res.status(200).json({
      budgets,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load budgets.',
      error: error.message,
    });
  }
};

module.exports = {
  setBudget,
  getBudgets,
};