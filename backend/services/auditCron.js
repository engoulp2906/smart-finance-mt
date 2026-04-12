const cron = require('node-cron');
const User = require('../models/User');
const { runFinancialAudit } = require('./auditService');

const startAuditCron = () => {
  cron.schedule('*/1 * * * *', async () => {
    try {
      const users = await User.find({});

      if (users.length === 0) {
        console.log('[CRON] Database empty. Waiting for users...');
        return;
      }

      for (const user of users) {
        await runFinancialAudit(user._id);
      }

      console.log('[CRON] Background audit completed for all users.');
    } catch (error) {
      console.error('[CRON] Error during audit:', error.message);
    }
  });

  console.log('[CRON] Financial audit scheduler started. Running every 1 minute.');
};

module.exports = {
  startAuditCron,
};
