import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import http from '../api/http';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [linkedBank, setLinkedBank] = useState('None');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await http.post('/auth/register', {
        name,
        phone,
        password,
        linkedBank,
      });

      const token = response.data?.token;
      if (!token) {
        throw new Error('Token not received from server.');
      }

      localStorage.setItem('token', token);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/90 p-8 shadow-glow backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">FinTech Cloud</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-100">Create Account</h1>
        <p className="mt-2 text-sm text-slate-400">Register to access your secure wallet and transaction ledger.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-300">Full Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-emerald-400 focus:ring"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-300">Phone</label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Enter phone"
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-emerald-400 focus:ring"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-emerald-400 focus:ring"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-300">Linked Bank</label>
            <input
              value={linkedBank}
              onChange={(event) => setLinkedBank(event.target.value)}
              placeholder="None"
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-emerald-400 focus:ring"
            />
          </div>

          {error ? <p className="text-sm font-semibold text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-emerald-300 hover:text-emerald-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}