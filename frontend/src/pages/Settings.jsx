import { useMemo, useState } from 'react';

const getPhoneFromToken = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return '';

    const payload = token.split('.')[1];
    if (!payload) return '';

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const normalized = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = JSON.parse(atob(normalized));
    return decoded.phone || '';
  } catch {
    return '';
  }
};

export default function Settings() {
  const initialPhone = useMemo(() => getPhoneFromToken(), []);
  const [name, setName] = useState('Venkata Manoj Kumar');
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (!name.trim() || !phone.trim()) {
      setError('Name and phone number are required.');
      return;
    }

    setToast('Settings updated successfully.');
    setPassword('');
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
      <h2 className="text-2xl font-bold text-slate-100">Settings</h2>
      <p className="mt-2 text-sm text-slate-400">Update your profile details and account password.</p>

      <form onSubmit={handleSubmit} className="mt-5 max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-300">Name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
            placeholder="Enter full name"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-300">Phone Number</label>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
            placeholder="Enter phone number"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-300">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-cyan-400 focus:ring"
            placeholder="Enter new password"
          />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-cyan-950 transition hover:bg-cyan-200"
        >
          Save Changes
        </button>

        {toast ? <p className="text-sm font-semibold text-emerald-300">{toast}</p> : null}
        {error ? <p className="text-sm font-semibold text-rose-300">{error}</p> : null}
      </form>
    </section>
  );
}