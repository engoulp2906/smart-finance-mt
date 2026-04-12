const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const transactionRoutes = require('./routes/transaction');
const walletRoutes = require('./routes/wallet');
const billRoutes = require('./routes/bill');
const budgetRoutes = require('./routes/budget');
const demoRoutes = require('./routes/demo');
const authRoutes = require('./routes/auth');
const payRoutes = require('./routes/pay');
const bbpsRoutes = require('./routes/bbps');
const alertRoutes = require('./routes/alert');
const { startAuditCron } = require('./services/auditCron');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('MongoDB URI missing. Set MONGO_URI or MONGODB_URI in environment variables.');
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api', transactionRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/pay', payRoutes);
app.use('/api/bbps', bbpsRoutes);
app.use('/api/alerts', alertRoutes);

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    startAuditCron();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  });