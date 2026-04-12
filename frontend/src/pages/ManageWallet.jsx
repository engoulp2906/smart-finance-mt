import { useEffect, useMemo, useState } from 'react';
import http from '../api/http';
import TransactionList from '../components/TransactionList';

const bankOptions = ['HDFC', 'SBI', 'ICICI'];

const getUserIdFromToken = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return 'demo-user';

    const payload = token.split('.')[1];
    if (!payload) return 'demo-user';

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const normalized = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = JSON.parse(atob(normalized));
    return decoded.userId || 'demo-user';
  } catch {
    return 'demo-user';
  }
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount || 0);

export default function ManageWallet() {
  const userId = useMemo(() => getUserIdFromToken(), []);
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedBank, setSelectedBank] = useState(bankOptions[0]);
  const [addAmount, setAddAmount] = useState('');
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const pushSystemAlert = (alert) => {
    window.dispatchEvent(
      new CustomEvent('system-alert', {
        detail: {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          section: 'activity',
          ...alert,
        },
      })
    );
  };

  const loadBalance = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await http.get('/wallet/balance', {
        params: { userId },
      });

      setWalletBalance(response.data?.walletBalance || 0);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load wallet balance.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentTransactions = async () => {
    setIsLoadingRecent(true);
    setRecentError('');

    try {
      const response = await http.get('/transactions/recent');
      const transactions = response.data?.transactions || [];
      setRecentTransactions(transactions.filter((transaction) => transaction.predictedCategory === 'Bank Transfer'));
    } catch (requestError) {
      setRecentError(requestError?.response?.data?.message || 'Failed to load recent transactions.');
    } finally {
      setIsLoadingRecent(false);
    }
  };

  useEffect(() => {
    loadBalance();
    loadRecentTransactions();
  }, []);

  const handleLinkBank = () => {
    setToast(`Linked ${selectedBank} account successfully.`);
    setTimeout(() => setToast(''), 2500);
  };

  const handleAddFunds = async () => {
    const amount = Number(addAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    setIsAddingFunds(true);
    setError('');

    try {
      const response = await http.post('/wallet/add-funds', {
        userId,
        amount,
      });

      setWalletBalance(response.data?.walletBalance || walletBalance);
      setAddAmount('');
      setToast('Funds added to wallet.');
      pushSystemAlert({
        type: 'success',
        title: 'Funds Added',
        message: `${formatCurrency(amount)} added to wallet balance.`,
      });
      setTimeout(() => setToast(''), 2500);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to add funds.');
      window.dispatchEvent(
        new CustomEvent('system-alert', {
          detail: {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            section: 'important',
            type: 'warning',
            title: 'Add Funds Failed',
            message: requestError?.response?.data?.message || 'Failed to add funds.',
          },
        })
      );
    } finally {
      setIsAddingFunds(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
        <h2 className="text-2xl font-bold text-slate-100">Manage Wallet</h2>
        <p className="mt-2 text-sm text-slate-400">View balance, link a bank account, and add funds instantly.</p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-300/20 bg-slate-800/80 p-4 md:col-span-1">
            <p className="text-xs uppercase tracking-wider text-emerald-300">Current Balance</p>
            <p className="mt-2 text-3xl font-extrabold text-emerald-200">
              {isLoading ? 'Loading...' : formatCurrency(walletBalance)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 md:col-span-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">Link Bank Account</label>
                <select
                  value={selectedBank}
                  onChange={(event) => setSelectedBank(event.target.value)}
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
                >
                  {bankOptions.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleLinkBank}
                  className="mt-3 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-cyan-950 hover:bg-cyan-200"
                >
                  Link Bank
                </button>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">Add Funds</label>
                <input
                  value={addAmount}
                  onChange={(event) => setAddAmount(event.target.value)}
                  type="number"
                  min="1"
                  placeholder="Enter amount"
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-emerald-400 focus:ring"
                />
                <button
                  type="button"
                  onClick={handleAddFunds}
                  disabled={isAddingFunds}
                  className="mt-3 rounded-xl bg-emerald-300 px-4 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAddingFunds ? 'Adding...' : 'Add Funds'}
                </button>
              </div>
            </div>

            {toast ? <p className="mt-3 text-sm font-semibold text-emerald-300">{toast}</p> : null}
            {error ? <p className="mt-3 text-sm font-semibold text-rose-300">{error}</p> : null}
          </div>
        </div>
      </section>

      <TransactionList
        transactions={recentTransactions}
        isLoading={isLoadingRecent}
        error={recentError}
        onRefresh={loadRecentTransactions}
      />
    </div>
  );
}