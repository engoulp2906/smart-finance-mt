import { useEffect, useState } from 'react';
import http from '../api/http';

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

export default function FullHistory() {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAllTransactions = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await http.get('/transactions/all');
      setTransactions(response.data?.transactions || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load transaction history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllTransactions();
  }, []);

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">Transaction History</h2>
        <button
          type="button"
          onClick={loadAllTransactions}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          Refresh
        </button>
      </div>

      <p className="mt-2 text-sm text-slate-400">Complete ledger of all payments sorted by newest first.</p>

      {isLoading ? <p className="mt-4 text-sm text-slate-400">Loading full history...</p> : null}
      {error ? <p className="mt-4 text-sm font-semibold text-rose-300">{error}</p> : null}

      {!isLoading && !error ? (
        <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-slate-700">
          <table className="min-w-full divide-y divide-slate-700 text-sm">
            <thead className="sticky top-0 bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Description</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-300">Category</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-300">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transactions.map((transaction) => (
                <tr key={transaction._id} className="bg-slate-900/50 hover:bg-slate-800/70">
                  <td className="px-4 py-3 text-slate-300">{new Date(transaction.transactionDate).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-200">{transaction.rawDescription || 'Not provided'}</td>
                  <td className="px-4 py-3 text-sky-300">{transaction.predictedCategory || 'Uncategorized'}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      Number(transaction.amount || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {formatSignedAmount(transaction.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}