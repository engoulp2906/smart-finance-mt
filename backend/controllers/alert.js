const Alert = require('../models/Alert');
const User = require('../models/User');

const getAlerts = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized user context.' });
    }

    const currentUser = await User.findOne({ userId }, { _id: 1 }).lean();
    const identityValues = [userId];

    if (currentUser?._id) {
      identityValues.push(String(currentUser._id));
    }

    const alerts = await Alert.find({ userId: { $in: identityValues } })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch alerts.',
      error: error.message,
    });
  }
};

module.exports = {
  getAlerts,
};
