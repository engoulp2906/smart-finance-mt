import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import http from '../api/http';

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleInitializeDemo = async () => {
    setIsInitializing(true);
    try {
      await fetch('http://localhost:5000/api/demo/seed', {
        method: 'POST',
      });
      showToast('Demo Account Prepared! You may now log in.');
    } catch (err) {
      showToast('Failed to initialize demo account.', 'error');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await http.post('/auth/login', { phone, password });
      const token = response.data?.token;

      if (!token) {
        throw new Error('Token not received from server.');
      }

      localStorage.setItem('token', token);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      {toast ? (
        <div
          className={`fixed right-5 top-5 z-50 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
            toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-emerald-950'
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/90 p-8 shadow-glow backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">FinTech Cloud</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-100">Welcome Back</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in to access your wallet, payments, and live ledger.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-300">Phone</label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Enter phone"
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
              required
            />
          </div>

          {error ? <p className="text-sm font-semibold text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-cyan-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-400">
          New user?{' '}
          <Link to="/register" className="font-semibold text-cyan-300 hover:text-cyan-200">
            Create account
          </Link>
        </p>

        <div className="mt-8 border-t border-slate-700 pt-4">
          <button
            type="button"
            onClick={handleInitializeDemo}
            disabled={isInitializing}
            className="text-xs text-slate-500 transition hover:text-slate-400 disabled:cursor-not-allowed"
          >
            {isInitializing ? 'Initializing...' : 'Initialize Live Demo State'}
          </button>
        </div>
      </div>
    </div>
  );
}