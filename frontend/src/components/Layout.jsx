import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import http from '../api/http';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Manage Wallet', to: '/wallet' },
  { label: 'Set Budgets', to: '/budgets' },
  { label: 'Transaction History', to: '/history' },
  { label: 'Settings', to: '/settings' },
];

const defaultImportantAlerts = [];

const alertStyleMap = {
  critical: {
    card: 'border-rose-400/50 bg-rose-500/10',
    text: 'text-rose-100',
    title: 'text-rose-200',
    icon: 'bg-rose-400 animate-pulse',
  },
  warning: {
    card: 'border-amber-400/50 bg-amber-500/10',
    text: 'text-amber-100',
    title: 'text-amber-200',
    icon: 'bg-amber-300',
  },
  success: {
    card: 'border-emerald-400/50 bg-emerald-500/10',
    text: 'text-emerald-100',
    title: 'text-emerald-200',
    icon: 'bg-emerald-300',
  },
  info: {
    card: 'border-sky-400/50 bg-sky-500/10',
    text: 'text-sky-100',
    title: 'text-sky-200',
    icon: 'bg-sky-300',
  },
};

export default function Layout({ children }) {
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [importantAlerts, setImportantAlerts] = useState(defaultImportantAlerts);
  const [activityAlerts, setActivityAlerts] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const sortedDbAlerts = useMemo(() => {
    const severityWeight = {
      CRITICAL: 1,
      WARNING: 2,
      SUCCESS: 3,
    };

    return [...alerts].sort((left, right) => {
      const leftType = String(left?.type || '').toUpperCase();
      const rightType = String(right?.type || '').toUpperCase();

      const leftWeight = severityWeight[leftType] || 4;
      const rightWeight = severityWeight[rightType] || 4;

      if (leftWeight !== rightWeight) {
        return leftWeight - rightWeight;
      }

      const leftTime = new Date(left?.createdAt || 0).getTime();
      const rightTime = new Date(right?.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
  }, [alerts]);

  const sortedImportantAlerts = useMemo(() => {
    const severityPriority = {
      critical: 0,
      warning: 1,
      success: 2,
      info: 3,
    };

    const dbAlertSignatures = new Set(
      sortedDbAlerts.map((alert) => {
        const title = String(alert?.title || 'System Alert').trim().toLowerCase();
        const message = String(alert?.message || '').trim().toLowerCase();
        return `${title}::${message}`;
      })
    );

    const sorted = importantAlerts
      .map((alert, index) => ({ alert, index }))
      .sort((a, b) => {
        const aPriority = severityPriority[a.alert.type] ?? 99;
        const bPriority = severityPriority[b.alert.type] ?? 99;

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        return a.index - b.index;
      })
      .map((entry) => entry.alert);

    const seenSignatures = new Set();
    return sorted.filter((alert) => {
      const title = String(alert?.title || 'System Alert').trim().toLowerCase();
      const message = String(alert?.message || '').trim().toLowerCase();
      const signature = `${title}::${message}`;

      if (seenSignatures.has(signature)) {
        return false;
      }

      if (dbAlertSignatures.has(signature)) {
        return false;
      }

      seenSignatures.add(signature);
      return true;
    });
  }, [importantAlerts, sortedDbAlerts]);

  useEffect(() => {
    const handleSystemAlert = (event) => {
      const detail = event?.detail;
      if (!detail || typeof detail !== 'object') {
        return;
      }

      const nextAlert = {
        id: detail.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: detail.type || 'info',
        title: detail.title || 'System Alert',
        message: detail.message || '',
      };

      const alertSection =
        detail.section || (nextAlert.type === 'critical' || nextAlert.type === 'warning' ? 'important' : 'activity');

      // Session-only feed: keep every emitted alert until full page reload.
      setActivityAlerts((currentAlerts) => [nextAlert, ...currentAlerts]);

      if (alertSection === 'important') {
        setImportantAlerts((currentAlerts) => [nextAlert, ...currentAlerts].slice(0, 12));
      }
    };

    window.addEventListener('system-alert', handleSystemAlert);
    return () => window.removeEventListener('system-alert', handleSystemAlert);
  }, []);

  useEffect(() => {
    const fetchBudgetInsights = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('/api/transactions/insights', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        const { alerts } = data;

        if (Array.isArray(alerts) && alerts.length > 0) {
          const insightAlerts = alerts.map((alert) => ({
            id: `insight-${alert.type}-${Date.now()}`,
            type: alert.type || 'info',
            title: '💡 Expert AI Insight',
            message: alert.message || '',
          }));

          setImportantAlerts((currentAlerts) => {
            // Prevent duplicate insights
            const filteredCurrent = currentAlerts.filter(
              (a) => !a.id.startsWith('insight-')
            );
            return [...insightAlerts, ...filteredCurrent].slice(0, 12);
          });
        }
      } catch (error) {
        // Silently fail if insights endpoint is not available
      }
    };

    const token = localStorage.getItem('token');
    if (token) {
      fetchBudgetInsights();
    }
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await http.get('/alerts');
        const fetchedAlerts = Array.isArray(response.data?.alerts) ? response.data.alerts : [];
        setAlerts(fetchedAlerts);
      } catch (error) {
        // Keep UI stable if alerts endpoint is unavailable.
      }
    };

    fetchAlerts();

    const handleRefreshAlerts = () => {
      fetchAlerts();
    };

    window.addEventListener('refresh-alerts', handleRefreshAlerts);

    return () => {
      window.removeEventListener('refresh-alerts', handleRefreshAlerts);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <header className="fixed left-0 top-0 z-50 h-16 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="relative flex h-full items-center px-6 md:px-8">
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2">
            <h1 className="text-center text-lg font-extrabold tracking-tight text-cyan-200 drop-shadow-[0_0_14px_rgba(34,211,238,0.45)] md:text-xl">
              Smart Personal Finance Hub
            </h1>
          </div>

          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setIsProfileOpen((current) => !current)}
              className="flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900 px-3 py-2"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-300 text-sm font-bold text-cyan-950">
                VK
              </span>
              <span className="text-sm font-semibold text-slate-200">Venkata Manoj Kumar</span>
            </button>

            {isProfileOpen ? (
              <div className="absolute right-0 top-12 z-50 w-44 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-lg">
                <Link
                  to="/settings"
                  onClick={() => setIsProfileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-200 transition hover:bg-rose-500/10"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <aside className="fixed left-0 top-16 bottom-0 z-40 w-64 border-r border-slate-800 bg-slate-900/95 px-5 py-6 backdrop-blur">
        <nav className="flex h-full flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  isActive
                    ? 'bg-cyan-400 text-cyan-950 shadow-glow'
                    : 'bg-slate-800/70 text-slate-200 hover:bg-slate-700'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={handleLogout}
            className="mt-auto rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-left text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
          >
            Logout
          </button>
        </nav>
      </aside>

      <aside className="fixed right-0 top-16 bottom-0 z-40 w-80 border-l border-slate-700 bg-[#1e293b] p-4">
        <div className="sticky top-0 z-10 border-b border-slate-700 bg-[#1e293b] pb-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">Live System Alerts</h3>
        </div>

        <div className="mt-3 flex h-[calc(100%-3rem)] flex-col gap-4 pr-1">
          <section className="flex h-1/2 min-h-0 flex-col rounded-xl border border-slate-700 bg-slate-900/40 p-3">
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-rose-200">Important Alerts</h4>
            <div className="custom-scrollbar mt-3 flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {sortedDbAlerts.length === 0 && sortedImportantAlerts.length === 0 ? (
                <div className="p-3 border rounded text-slate-400">
                  No recent system alerts.
                </div>
              ) : (
                <>
                  {sortedDbAlerts.map((alert) => {
                    const color = String(alert?.color || '').toLowerCase();

                    let cardClass = 'border-l-4 border-green-500 bg-green-900/20 text-green-100';
                    let dotClass = 'bg-green-400';

                    if (color === 'red') {
                      cardClass = 'border-l-4 border-red-500 bg-red-900/20 text-red-100';
                      dotClass = 'bg-red-400 animate-pulse';
                    } else if (color === 'yellow') {
                      cardClass = 'border-l-4 border-yellow-500 bg-yellow-900/20 text-yellow-100';
                      dotClass = 'bg-yellow-400';
                    }

                    return (
                      <article key={alert._id || `${alert.type}-${alert.createdAt}`} className={`rounded-xl p-3 ${cardClass}`}>
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dotClass}`} />
                          <div>
                            <p className="text-sm font-bold">{alert.title || 'System Alert'}</p>
                            <p className="mt-1 text-xs leading-5">{alert.message}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {sortedImportantAlerts.map((alert) => {
                    const style = alertStyleMap[alert.type] || alertStyleMap.info;

                    return (
                      <article
                        key={alert.id}
                        className={`rounded-xl border p-3 shadow-lg transition-all duration-200 hover:shadow-cyan-500/10 ${style.card}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${style.icon}`} />
                          <div>
                            <p className={`text-sm font-bold ${style.title}`}>{alert.title}</p>
                            <p className={`mt-1 text-xs leading-5 ${style.text}`}>{alert.message}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </>
              )}
            </div>
          </section>

          <section className="flex h-1/2 min-h-0 flex-col rounded-xl border border-slate-700 bg-slate-900/40 p-3">
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Live Activity Feed</h4>
            <div className="custom-scrollbar mt-3 flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {activityAlerts.length === 0 ? (
                <p className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
                  Session activity appears here as you add money, pay bills, and make transfers.
                </p>
              ) : null}

              {activityAlerts.map((alert) => {
                const style = alertStyleMap[alert.type] || alertStyleMap.info;

                return (
                  <article
                    key={alert.id}
                    className={`rounded-xl border p-3 shadow-lg transition-all duration-200 hover:shadow-cyan-500/10 ${style.card}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${style.icon}`} />
                      <div>
                        <p className={`text-sm font-bold ${style.title}`}>{alert.title}</p>
                        <p className={`mt-1 text-xs leading-5 ${style.text}`}>{alert.message}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </aside>

      <main className="ml-64 mr-80 mt-16 h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-8">{children || <Outlet />}</div>
      </main>
    </div>
  );
}