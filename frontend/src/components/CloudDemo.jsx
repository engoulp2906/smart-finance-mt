import { useEffect, useMemo, useState } from 'react';
import { fetchDemoWalletBalance, payDemoBill } from '../api/demo';

const paymentOptions = [
  { billName: 'Electricity Bill', amount: 80, label: 'Pay Electricity Bill ($80)' },
  { billName: 'Water Bill', amount: 45, label: 'Pay Water Bill ($45)' },
  { billName: 'Internet Bill', amount: 60, label: 'Pay Internet ($60)' },
];

export default function CloudDemo({ onPaymentSuccess }) {
  const [walletBalance, setWalletBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [payingBillName, setPayingBillName] = useState('');
  const [notification, setNotification] = useState(null);

  const formattedBalance = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(walletBalance || 0),
    [walletBalance]
  );

  const loadBalance = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDemoWalletBalance();
      setWalletBalance(data.walletBalance || 0);
    } catch (error) {
      setNotification({
        type: 'error',
        text: error?.response?.data?.message || 'Failed to load digital wallet balance.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBalance();
  }, []);

  const handlePayBill = async ({ billName, amount }) => {
    setPayingBillName(billName);
    setNotification(null);

    try {
      const result = await payDemoBill({ billName, amount });
      setWalletBalance(result.walletBalance || 0);
      setNotification({
        type: 'success',
        text: `${billName} paid and event propagated to AI categorization.`,
      });

      if (onPaymentSuccess) {
        await onPaymentSuccess();
      }
    } catch (error) {
      setNotification({
        type: 'error',
        text: error?.response?.data?.message || 'Demo payment failed.',
      });
    } finally {
      setPayingBillName('');
    }
  };

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-900/80 p-6 shadow-glow backdrop-blur">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-300/20 bg-slate-800/80 p-5 lg:col-span-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Digital Wallet</p>
          <p className="mt-3 text-4xl font-extrabold text-emerald-200">{isLoading ? 'Loading...' : formattedBalance}</p>
          <p className="mt-2 text-sm text-slate-300">Live balance for demo user after each event-driven payment.</p>
        </div>

        <div className="rounded-2xl border border-cyan-300/20 bg-slate-800/80 p-5 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-100">Simulate Utility Payment</h2>
          <p className="mt-1 text-sm text-slate-300">
            Each click triggers wallet deduction, AI categorization, MongoDB transaction write, and chart refresh.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {paymentOptions.map((option) => (
              <button
                key={option.billName}
                type="button"
                onClick={() => handlePayBill(option)}
                disabled={Boolean(payingBillName)}
                className="rounded-xl bg-cyan-300 px-3 py-3 text-sm font-bold text-cyan-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {payingBillName === option.billName ? 'Processing...' : option.label}
              </button>
            ))}
          </div>

          {notification ? (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
                notification.type === 'error'
                  ? 'bg-rose-500/15 text-rose-200 border border-rose-400/30'
                  : 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30'
              }`}
            >
              {notification.text}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}