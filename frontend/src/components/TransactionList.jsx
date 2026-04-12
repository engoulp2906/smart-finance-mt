import { useEffect, useState } from 'react';
import http from '../api/http';

const iconForPurpose = (purpose = '') => {
  const normalized = purpose.toLowerCase();

  if (normalized.includes('food')) return '🍽';
  if (normalized.includes('transport')) return '🚕';
  if (normalized.includes('utilities')) return '⚡';
  if (normalized.includes('shopping')) return '🛍';
  if (normalized.includes('health')) return '💊';
  if (normalized.includes('entertain')) return '🎬';

  return '💳';
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount || 0);

const formatSignedAmount = (amount) => {
  const value = Math.abs(Number(amount || 0));
  const prefix = Number(amount || 0) >= 0 ? '+₹' : '-₹';

  return `${prefix}${new Intl.NumberFormat('en-IN').format(value)}`;
};

export default function TransactionList({ transactions, isLoading, error, onRefresh }) {
  const isControlled = Array.isArray(transactions);
  const [internalTransactions, setInternalTransactions] = useState([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState('');

  const fetchRecentTransactions = async () => {
    const response = await http.get('/transactions/recent');
    return response.data?.transactions || [];
  };

  const loadTransactions = async () => {
    if (isControlled) {
      if (onRefresh) {
        await onRefresh();
      }
      return;
    }

    setInternalLoading(true);
    setInternalError('');

    try {
      const recent = await fetchRecentTransactions();
      setInternalTransactions(recent);
    } catch (requestError) {
      setInternalError(requestError?.response?.data?.message || 'Failed to load transactions.');
    } finally {
      setInternalLoading(false);
    }
  };

  useEffect(() => {
    if (isControlled) {
      return;
    }

    loadTransactions();
  }, [isControlled]);

  const resolvedTransactions = isControlled ? transactions : internalTransactions;
  const resolvedLoading = isControlled ? Boolean(isLoading) : internalLoading;
  const resolvedError = isControlled ? error || '' : internalError;

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-100">Recent Transactions</h3>
        <button
          type="button"
          onClick={loadTransactions}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          Refresh
        </button>
      </div>

      {resolvedLoading ? <p className="mt-4 text-sm text-slate-400">Loading ledger...</p> : null}
      {resolvedError ? <p className="mt-4 text-sm font-semibold text-rose-300">{resolvedError}</p> : null}

      {!resolvedLoading && !resolvedError ? (
        <ul className="mt-4 space-y-3">
          {resolvedTransactions.map((txn) => {
            const isDeposit = Number(txn.amount || 0) >= 0;

            return (
              <li
                key={txn._id}
                className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/70 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-lg">
                    {iconForPurpose(txn.predictedCategory)}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-100">{txn.predictedCategory || 'Payment'}</p>
                    <p className="text-xs text-slate-400">
                      {(txn.predictedCategory || 'Payment')}: {txn.rawDescription || 'Not provided'}
                    </p>
                    <p className="text-xs text-slate-500">{new Date(txn.transactionDate).toLocaleString()}</p>
                  </div>
                </div>

                <p className={`text-sm font-extrabold ${isDeposit ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {formatSignedAmount(txn.amount)}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}