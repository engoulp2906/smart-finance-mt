import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { uploadTransactionCsv } from '../api/transactions';
import http from '../api/http';
import TransactionList from './TransactionList';

ChartJS.register(ArcElement, Tooltip, Legend);

const chartColors = ['#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e'];

const normalizeCategoryKey = (category = '') => {
  const normalized = String(category).trim().toLowerCase();

  if (normalized.includes('movie') || normalized.includes('entertain')) return 'Entertainment';
  if (normalized.includes('food')) return 'Food';
  if (normalized.includes('transport')) return 'Transport';
  if (normalized.includes('utilit') || normalized.includes('grocery')) return 'Utilities';
  if (normalized.includes('shop')) return 'Shopping';
  if (normalized.includes('education')) return 'Education/Special';

  return String(category || 'Uncategorized');
};

export default function Dashboard() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [walletBalance, setWalletBalance] = useState(12500);
  const [summary, setSummary] = useState({
    labels: [],
    values: [],
  });
  const [selectedBiller, setSelectedBiller] = useState('Electricity');
  const [canNumber, setCanNumber] = useState('');
  const [autoPayDay, setAutoPayDay] = useState('5');
  const [linkedBills, setLinkedBills] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [isPayingNow, setIsPayingNow] = useState(false);
  const [toast, setToast] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState('');
  const [insights, setInsights] = useState(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(true);
  const budgetAlertStatusRef = useRef({});

  const pushSystemAlert = (alert) => {
    window.dispatchEvent(
      new CustomEvent('system-alert', {
        detail: {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          ...alert,
        },
      })
    );
  };

  const normalizeLinkedBill = (bill) => ({
    ...bill,
    mockBillAmount: Number(bill?.mockBillAmount || 850),
    autoPayDay: bill?.autoPayDay ? Number(bill.autoPayDay) : null,
    billGenerated: typeof bill?.billGenerated === 'boolean' ? bill.billGenerated : !Boolean(bill?.isAutoPay),
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadRecentTransactions = async () => {
    setIsLoadingRecent(true);
    setRecentError('');

    try {
      const response = await http.get('/transactions/recent');
      setRecentTransactions(response.data?.transactions || []);
    } catch (error) {
      setRecentError(error?.response?.data?.message || 'Failed to load recent transactions.');
    } finally {
      setIsLoadingRecent(false);
    }
  };

  const loadLinkedBills = async () => {
    try {
      const response = await http.get('/bbps/linked');
      const bills = (response.data?.linkedBills || []).map(normalizeLinkedBill);
      setLinkedBills(bills);
    } catch {
      // Keep local demo state if the backend request fails.
    }
  };

  const loadWalletBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const payload = token.split('.')[1];
      if (!payload) return;

      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const normalized = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const decoded = JSON.parse(atob(normalized));
      const userId = decoded.userId;

      if (!userId) return;

      const response = await http.get('/wallet/balance', {
        params: { userId },
      });

      if (typeof response.data?.walletBalance === 'number') {
        setWalletBalance(response.data.walletBalance);
      }
    } catch {
      // Keep current wallet value if request fails.
    }
  };

  const loadChartSummary = async () => {
    try {
      const response = await http.get('/transactions/all');
      const allTransactions = response.data?.transactions || [];

      const expenseTransactions = allTransactions.filter((txn) => txn.predictedCategory !== 'Bank Transfer');

      const totalsByCategory = expenseTransactions.reduce((acc, txn) => {
        const category = txn.predictedCategory || 'Uncategorized';
        acc[category] = (acc[category] || 0) + Math.abs(Number(txn.amount || 0));
        return acc;
      }, {});

      const labels = Object.keys(totalsByCategory);
      const values = labels.map((label) => Number(totalsByCategory[label].toFixed(2)));

      setSummary({ labels, values });
    } catch {
      // Keep current summary if request fails.
    }
  };

  const evaluateBudgetThresholds = async () => {
    try {
      const [budgetResponse, transactionResponse] = await Promise.all([
        http.get('/budgets'),
        http.get('/transactions/all'),
      ]);

      const budgets = budgetResponse.data?.budgets || [];
      const allTransactions = transactionResponse.data?.transactions || [];
      const spentByCategory = allTransactions.reduce((accumulator, transaction) => {
        const amount = Number(transaction.amount || 0);
        if (amount >= 0) {
          return accumulator;
        }

        const category = normalizeCategoryKey(transaction.predictedCategory);
        accumulator[category] = (accumulator[category] || 0) + Math.abs(amount);
        return accumulator;
      }, {});

      budgets.forEach((budget) => {
        const category = normalizeCategoryKey(budget.category);
        const limit = Number(budget.limit || 0);
        if (!Number.isFinite(limit) || limit <= 0) {
          return;
        }

        const spent = Number(spentByCategory[category] || 0);
        const ratio = spent / limit;
        const left = Math.max(limit - spent, 0);

        let nextStatus = 'safe';
        if (ratio >= 1) {
          nextStatus = 'crossed';
        } else if (ratio >= 0.8) {
          nextStatus = 'near';
        }

        // Initialize ref if this is first check for this category
        if (!(category in budgetAlertStatusRef.current)) {
          budgetAlertStatusRef.current[category] = nextStatus;
          // Don't emit alert on first time seeing this status
          return;
        }

        const previousStatus = budgetAlertStatusRef.current[category];
        if (nextStatus === previousStatus) {
          return;
        }

        if (nextStatus === 'near') {
          pushSystemAlert({
            section: 'activity',
            type: 'warning',
            title: 'Budget Near Limit',
            message: `${category} budget is at ${Math.round(ratio * 100)}%. Only ${formatCurrency(left)} left this month.`,
          });
        }

        if (nextStatus === 'crossed') {
          pushSystemAlert({
            section: 'activity',
            type: 'critical',
            title: 'Budget Crossed',
            message: `${category} budget crossed. Spent ${formatCurrency(spent)} against ${formatCurrency(limit)} limit.`,
          });
        }

        budgetAlertStatusRef.current[category] = nextStatus;
      });
    } catch {
      // Keep UI stable when budget checks fail.
    }
  };

  const loadInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const response = await http.get('/transactions/insights');
      setInsights(response.data);
    } catch {
      // Silently fail if insights endpoint is not available
      setInsights(null);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  useEffect(() => {
    loadRecentTransactions();
    loadWalletBalance();
    loadChartSummary();
    loadLinkedBills();
    evaluateBudgetThresholds();
    loadInsights();
  }, []);

  const handleQuickTransfer = async () => {
    const amount = Number(transferAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Please enter a valid transfer amount.');
      return;
    }

    if (!transferDescription.trim()) {
      setPaymentError('Please describe what this payment is for.');
      return;
    }

    setPaymentError('');
    setIsPayingNow(true);

    try {
      const response = await http.post('/pay', {
        amount,
        description: transferDescription,
      });

      setPaymentError('');
      setShowTransferModal(false);
      setTransferAmount('');
      setTransferDescription('');
      showToast('Payment completed successfully.', 'success');

        pushSystemAlert({
          section: 'activity',
          type: 'payment',
          title: 'Bill paid successfully',
          message: `${transferDescription} - ₹${Number(amount).toFixed(2)} paid.`,
          severity: 'INFO',
        });

      await Promise.all([
        loadWalletBalance(),
        loadRecentTransactions(),
        loadChartSummary(),
        evaluateBudgetThresholds(),
        loadInsights(),
      ]);

      window.dispatchEvent(new Event('refresh-alerts'));
    } catch (error) {
      setPaymentError(error?.response?.data?.error || 'Payment failed.');
    } finally {
      setIsPayingNow(false);
    }
  };

  const chartData = useMemo(
    () => ({
      labels: summary.labels,
      datasets: [
        {
          data: summary.values,
          backgroundColor: summary.labels.map((_, index) => chartColors[index % chartColors.length]),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    }),
    [summary]
  );

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files?.[0] || null);
    setStatusMessage('');
    setErrorMessage('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a CSV file first.');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const result = await uploadTransactionCsv(selectedFile);
      setStatusMessage(result?.message || 'CSV uploaded successfully.');
      setSelectedFile(null);
      showToast('Historical CSV imported.', 'success');
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'CSV upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkAccount = async () => {
    if (!canNumber.trim()) {
      setErrorMessage('Please enter a valid CAN Number.');
      return;
    }

    try {
      setErrorMessage('');
      const response = await http.post('/bbps/link', {
        billerType: selectedBiller,
        canNumber,
        isAutoPay: false,
      });

      const linkedBill = normalizeLinkedBill(response.data?.linkedBill || {});
      setLinkedBills((current) => [linkedBill, ...current.filter((item) => item._id !== linkedBill._id)]);
      showToast(`${selectedBiller} linked successfully.`, 'success');
      pushSystemAlert({
        section: 'activity',
        type: 'info',
        title: 'New Linked Bill',
        message: `${selectedBiller} account linked with CAN ${canNumber}.`,
      });
      setCanNumber('');
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to link bill account.');
    }
  };

  const handleSetAutoPay = async () => {
    if (!canNumber.trim()) {
      setErrorMessage('Please enter a valid CAN Number.');
      return;
    }

    const shouldUseAutoPayDay = selectedBiller === 'Rental Bill';
    const parsedAutoPayDay = Number(autoPayDay);

    if (
      shouldUseAutoPayDay &&
      (!Number.isInteger(parsedAutoPayDay) || parsedAutoPayDay < 1 || parsedAutoPayDay > 28)
    ) {
      setErrorMessage('Please select a valid auto-pay day (1-28).');
      return;
    }

    try {
      setErrorMessage('');
      const response = await http.post('/bbps/link', {
        billerType: selectedBiller,
        canNumber,
        isAutoPay: true,
        autoPayDay: shouldUseAutoPayDay ? parsedAutoPayDay : undefined,
      });

      const linkedBill = normalizeLinkedBill({
        ...response.data?.linkedBill,
        billGenerated: false,
      });

      setLinkedBills((current) => [linkedBill, ...current.filter((item) => item._id !== linkedBill._id)]);
      showToast(`${selectedBiller} set for auto pay.`, 'success');
      pushSystemAlert({
        section: 'activity',
        type: 'success',
        title: 'Auto Pay Enabled',
        message: shouldUseAutoPayDay
          ? `${selectedBiller} bill will auto-pay on day ${parsedAutoPayDay} each month.`
          : `${selectedBiller} bill will be auto-paid when generated.`,
      });
      setCanNumber('');
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Failed to configure auto pay.');
      pushSystemAlert({
        section: 'important',
        type: 'warning',
        title: 'Auto Pay Setup Failed',
        message: error?.response?.data?.message || 'Failed to configure auto pay.',
      });
    }
  };

  const handleGenerateBill = (billId) => {
    const nextAmount = Number((Math.random() * 900 + 700).toFixed(2));

    setLinkedBills((currentBills) =>
      currentBills.map((bill) =>
        bill._id === billId
          ? {
              ...bill,
              billGenerated: true,
              mockBillAmount: nextAmount,
            }
          : bill
      )
    );

    const bill = linkedBills.find((item) => item._id === billId);
    if (bill) {
      pushSystemAlert({
        section: 'activity',
        type: 'warning',
        title: 'New Bill Generated',
        message: `${bill.billerType} bill of ${formatCurrency(nextAmount)} is ready to pay.`,
      });
    }
  };

  const handlePayLinkedBill = async (bill) => {
    const amount = Number(bill?.mockBillAmount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage('Invalid bill amount.');
      return;
    }

    try {
      setErrorMessage('');
      const response = await http.post('/pay', {
        amount,
        description: `${bill.billerType} bill payment`,
      });

      const newBalance = response.data?.walletBalance;
      if (typeof newBalance === 'number') {
        setWalletBalance(newBalance);
      }

      const transaction = response.data?.transaction;
      if (transaction) {
        setRecentTransactions((current) => [transaction, ...current].slice(0, 10));
      } else {
        await loadRecentTransactions();
      }

      await loadChartSummary();
      await evaluateBudgetThresholds();

      setLinkedBills((currentBills) =>
        currentBills.map((item) =>
          item._id === bill._id
            ? {
                ...item,
                billGenerated: false,
              }
            : item
        )
      );

      showToast(`${bill.billerType} bill paid successfully.`, 'success');
      pushSystemAlert({
        section: 'activity',
        type: 'success',
        title: 'Bill Payment Successful',
        message: `${bill.billerType} bill of ${formatCurrency(amount)} paid via wallet.`,
      });
    } catch (error) {
      const message = error?.response?.data?.message || 'Bill payment failed.';
      setErrorMessage(message);
      pushSystemAlert({
        section: 'important',
        type: 'critical',
        title: 'Bill Payment Failed',
        message,
      });
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value || 0);

  const premiumCardClass =
    'rounded-xl border border-slate-700 bg-[#1e293b] p-6 shadow-lg transition-all duration-200 hover:border-cyan-400/30 hover:shadow-cyan-500/20';

  const primaryButtonClass =
    'inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-cyan-500/20';

  return (
    <div className="min-h-screen px-4 py-8 md:px-8">
      {toast ? (
        <div
          className={`fixed right-5 top-5 z-50 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
            toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-emerald-950'
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="w-full space-y-6">
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className={premiumCardClass}>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Wallet Balance</p>
            <p className="mt-3 text-4xl font-extrabold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              {formatCurrency(walletBalance)}
            </p>
            <p className="mt-3 text-sm text-slate-300">Live demo wallet synced with backend ledger.</p>
          </div>

          <div className={premiumCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-100">Quick Pay</h2>
              <span className="rounded-full bg-sky-400/20 px-3 py-1 text-xs font-semibold text-sky-200">
                Real-Time Ledger Update
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setPaymentError('');
                setShowTransferModal(true);
              }}
              className={`${primaryButtonClass} mt-6`}
            >
              Pay or Transfer
            </button>

            <p className="mt-4 text-sm text-slate-300">
              Opens a payment modal to send money instantly and update the wallet, chart, and transaction ledger.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">

          <div className={premiumCardClass}>
            <h2 className="text-xl font-bold text-slate-100">BBPS Bill Setup</h2>
            <p className="mt-1 text-sm text-slate-400">One-time account linking for recurring utility bill payments.</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Select Biller</label>
                <select
                  value={selectedBiller}
                  onChange={(event) => setSelectedBiller(event.target.value)}
                  className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
                >
                  <option>Electricity</option>
                  <option>Internet</option>
                  <option>Rental Bill</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">CAN Number</label>
                <input
                  value={canNumber}
                  onChange={(event) => setCanNumber(event.target.value)}
                  placeholder="Enter CAN Number"
                  className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
                />
              </div>

              {selectedBiller === 'Rental Bill' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-300">Auto Pay Day (1-28)</label>
                  <select
                    value={autoPayDay}
                    onChange={(event) => setAutoPayDay(event.target.value)}
                    className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
                  >
                    {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                      <option key={day} value={day}>
                        Day {day}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleLinkAccount}
                  className={`${primaryButtonClass} flex-1 px-4 py-2`}
                >
                  Link Account
                </button>
                <button
                  type="button"
                  onClick={handleSetAutoPay}
                  className={`${primaryButtonClass} flex-1 px-4 py-2`}
                >
                  Set Auto Pay
                </button>
              </div>
            </div>
          </div>

          <div className={premiumCardClass}>
            <h2 className="text-xl font-bold text-slate-100">Expense Categories</h2>
            <p className="mt-1 text-sm text-slate-400">Live category breakup from your full transaction history.</p>

            {summary.labels.length > 0 ? (
              <div className="mt-4 max-w-md">
                <Doughnut data={chartData} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">No transactions available yet for charting.</p>
            )}
          </div>
        </section>

        <section className={premiumCardClass}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Linked Bills</h2>
              <p className="mt-1 text-sm text-slate-400">Bills linked from the BBPS setup card.</p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
              {linkedBills.length} linked
            </span>
          </div>

          {linkedBills.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No linked bills yet.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {linkedBills.map((bill) => (
                <div
                  key={bill._id || bill.id}
                  className="rounded-xl border border-slate-700 bg-slate-800/70 p-4 shadow-lg transition-all duration-200 hover:border-cyan-400/30 hover:shadow-cyan-500/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-slate-100">{bill.billerType}</p>
                      <p className="text-xs text-slate-400">CAN: {bill.canNumber}</p>
                    </div>
                    <span className="rounded-full bg-cyan-400/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                      {bill.isAutoPay ? 'Auto Pay' : 'Manual Pay'}
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-200">
                    {bill.isAutoPay ? (
                      <p className="leading-6 text-slate-200">
                        This month {bill.billerType} bill not generated. Waiting for bill generation to auto pay.
                        {bill.autoPayDay ? ` Auto-pay scheduled on day ${bill.autoPayDay} of every month.` : ''}
                      </p>
                    ) : !bill.billGenerated ? (
                      <div className="space-y-3">
                        <p className="text-slate-300">No bill generated currently. Generate next bill to proceed with payment.</p>
                        <button
                          type="button"
                          onClick={() => handleGenerateBill(bill._id)}
                          className={`${primaryButtonClass} px-3 py-1.5 text-xs`}
                        >
                          Generate Next Bill
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-100">Bill Generated: {formatCurrency(bill.mockBillAmount)}</p>
                        <button
                          type="button"
                          onClick={() => handlePayLinkedBill(bill)}
                          className={`${primaryButtonClass} px-3 py-1.5 text-xs`}
                        >
                          Pay Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={premiumCardClass}>
          <h2 className="text-xl font-bold text-slate-100">50/30/20 Financial Health</h2>
          <p className="mt-1 text-sm text-slate-400">Elizabeth Warren's budget rule: divides income into Needs (50%), Wants (30%), and Savings (20%).</p>

          {isLoadingInsights ? (
            <div className="mt-4 animate-pulse space-y-3">
              <div className="h-3 w-1/3 rounded bg-slate-700" />
              <div className="h-2 w-full rounded bg-slate-700" />
              <div className="h-3 w-1/2 rounded bg-slate-700" />
              <div className="h-2 w-full rounded bg-slate-700" />
              <div className="h-3 w-2/5 rounded bg-slate-700" />
              <div className="h-2 w-full rounded bg-slate-700" />
            </div>
          ) : insights ? (
            <div className="mt-6 space-y-5">
              {(() => {
                const needsSpent = Math.abs(Number(insights.needsSpent || 0));
                const needsLimit = Number(insights.needsLimit || 0);
                const wantsSpent = Math.abs(Number(insights.wantsSpent || 0));
                const wantsLimit = Number(insights.wantsLimit || 0);
                const savingsGoal = Number(insights.savingsGoal || 0);
                const totalIncome = Number(insights.totalIncome || 0);
                const savingsSpent = Math.max(totalIncome - needsSpent - wantsSpent, 0);

                const getProgressWidth = (spent, limit) => {
                  if (!Number.isFinite(limit) || limit <= 0) return 0;
                  return Math.min(100, (spent / limit) * 100);
                };

                const needsProgress = getProgressWidth(needsSpent, needsLimit);
                const wantsProgress = getProgressWidth(wantsSpent, wantsLimit);
                const savingsProgress = getProgressWidth(savingsSpent, savingsGoal);

                return (
                  <>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">
                    Needs (50%) - Essential expenses
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    {formatCurrency(needsSpent)} / {formatCurrency(needsLimit)}
                  </span>
                </div>
                <div className="w-full overflow-hidden rounded-full bg-slate-700 h-2">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{
                      width: `${needsProgress}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {Math.round(needsProgress)}% of limit
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">
                    Wants (30%) - Discretionary spending
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    {formatCurrency(wantsSpent)} / {formatCurrency(wantsLimit)}
                  </span>
                </div>
                <div className="w-full overflow-hidden rounded-full bg-slate-700 h-2">
                  <div
                    className={`h-full transition-all duration-300 ${
                      wantsProgress >= 100 ? 'bg-red-500' : 'bg-yellow-500'
                    }`}
                    style={{
                      width: `${wantsProgress}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {Math.round(wantsProgress)}% of limit
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">
                    Savings Goal (20%) - Building wealth
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    {formatCurrency(savingsSpent)} / {formatCurrency(savingsGoal)}
                  </span>
                </div>
                <div className="w-full overflow-hidden rounded-full bg-slate-700 h-2">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${savingsProgress}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {Math.round(savingsProgress)}% of goal
                </p>
              </div>

              <p className="mt-4 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
                Based on Elizabeth Warren's 50/30/20 Rule
              </p>
                  </>
                );
              })()}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No insight data available yet.</p>
          )}
        </section>

        <section className={premiumCardClass}>
          <h2 className="text-xl font-bold text-slate-100">CSV Transaction Import</h2>
          <p className="mt-1 text-sm text-slate-400">
            Existing ingestion path for bulk transactions and AI categorization.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
            />
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              className={`${primaryButtonClass} px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100`}
            >
              {isUploading ? 'Uploading CSV...' : 'Upload CSV'}
            </button>
          </div>

          {selectedFile ? <p className="mt-3 text-sm text-slate-300">Selected: {selectedFile.name}</p> : null}
          {statusMessage ? <p className="mt-2 text-sm font-semibold text-emerald-300">{statusMessage}</p> : null}
          {errorMessage ? <p className="mt-2 text-sm font-semibold text-rose-300">{errorMessage}</p> : null}
        </section>

        <TransactionList
          transactions={recentTransactions}
          isLoading={isLoadingRecent}
          error={recentError}
          onRefresh={loadRecentTransactions}
        />
      </div>

      {showTransferModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-[#1e293b] p-6 shadow-lg">
            <h3 className="text-xl font-bold text-slate-100">Quick Transfer</h3>
            <p className="mt-1 text-sm text-slate-400">Transfer funds and let AI categorize the payment from description.</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">Amount (₹)</label>
                <input
                  value={transferAmount}
                  onChange={(event) => setTransferAmount(event.target.value)}
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Enter amount"
                  className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">
                  What is this payment for? (e.g., travelling in car, lunch meal)
                </label>
                <input
                  value={transferDescription}
                  onChange={(event) => setTransferDescription(event.target.value)}
                  type="text"
                  placeholder="Enter payment description"
                  className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
                />
              </div>
            </div>

            <div className="mt-5">
              {paymentError && <p className="text-red-500 text-sm mb-2">{paymentError}</p>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentError('');
                    setShowTransferModal(false);
                  }}
                  className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-200 hover:border-slate-500 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleQuickTransfer}
                  disabled={isPayingNow}
                  className={`${primaryButtonClass} px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100`}
                >
                  {isPayingNow ? 'Processing...' : 'Pay Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}