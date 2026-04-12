import { useEffect, useState } from 'react';
import http from '../api/http';

const budgetCategories = ['Food', 'Transport', 'Utilities', 'Shopping', 'Entertainment', 'Education/Special'];

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount || 0);

export default function SetBudgets() {
  const [category, setCategory] = useState(budgetCategories[0]);
  const [limit, setLimit] = useState('');
  const [budgets, setBudgets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const loadBudgets = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await http.get('/budgets');
      setBudgets(response.data?.budgets || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load budgets.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const parsedLimit = Number(limit);
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setError('Please enter a valid monthly limit.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const response = await http.post('/budgets', {
        category,
        limit: parsedLimit,
      });

      const savedBudget = response.data?.budget;
      if (savedBudget) {
        setBudgets((currentBudgets) => {
          const remainingBudgets = currentBudgets.filter(
            (budget) => budget.category !== savedBudget.category
          );

          return [savedBudget, ...remainingBudgets];
        });
      } else {
        await loadBudgets();
      }

      setLimit('');
      setToast(`${category} budget updated.`);
      setTimeout(() => setToast(''), 2500);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to save budget.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-700 bg-[#1e293b] p-6 shadow-lg transition-all duration-200 hover:border-cyan-400/30 hover:shadow-cyan-500/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Set Budgets</h2>
            <p className="mt-2 text-sm text-slate-400">Create or update a monthly limit for each spending category.</p>
          </div>
          <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-semibold text-cyan-200">
            Budget Planning
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-300">Category</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
            >
              {budgetCategories.map((budgetCategory) => (
                <option key={budgetCategory} value={budgetCategory}>
                  {budgetCategory}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-300">Monthly Limit (₹)</label>
            <input
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              type="number"
              min="1"
              step="1"
              placeholder="Enter monthly limit"
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {isSaving ? 'Saving...' : 'Save Budget'}
            </button>
          </div>
        </form>

        {toast ? <p className="mt-4 text-sm font-semibold text-emerald-300">{toast}</p> : null}
        {error ? <p className="mt-4 text-sm font-semibold text-rose-300">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-700 bg-[#1e293b] p-6 shadow-lg transition-all duration-200 hover:border-cyan-400/30 hover:shadow-cyan-500/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-100">Active Budgets</h3>
            <p className="mt-1 text-sm text-slate-400">Your currently configured category limits.</p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
            {budgets.length} active
          </span>
        </div>

        {isLoading ? (
          <p className="mt-4 text-sm text-slate-400">Loading budgets...</p>
        ) : budgets.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No budgets set yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {budgets.map((budget) => (
              <div
                key={budget._id}
                className="rounded-xl border border-slate-700 bg-slate-800/70 p-4 shadow-lg transition-all duration-200 hover:border-cyan-400/30 hover:shadow-cyan-500/20"
              >
                <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">{budget.category}</p>
                <p className="mt-2 text-3xl font-extrabold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  {formatCurrency(budget.limit)}
                </p>
                <p className="mt-2 text-sm text-slate-400">Monthly limit set for this category.</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}