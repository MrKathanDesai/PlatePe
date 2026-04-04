import { useEffect, useState } from 'react';
import { Monitor, Plus, ChevronRight, CircleDot, RefreshCw } from 'lucide-react';
import {
  getTerminals,
  getTables,
  getOrders,
  getActiveSession,
  ApiTerminal,
  ApiSession,
  ApiTable,
  ApiOrder,
  getToken,
} from '../api';

interface DashboardProps {
  sessionId: string | null;
  onOpenSession: () => void;
  onAddTerminal: () => void;
  onSessionClosed: () => void;
}

function formatDuration(startIso: string) {
  const ms = Date.now() - new Date(startIso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function StatCard({ label, value, sub, dark = false }: { label: string; value: string; sub?: string; dark?: boolean }) {
  if (dark) {
    return (
      <div className="bg-[#111111] text-white rounded-2xl p-7 border border-zinc-900 flex flex-col justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
        <div>
          <p className="mt-3 text-4xl font-bold text-white tracking-tight">{value}</p>
          {sub && <p className="mt-2 text-xs text-zinc-500">{sub}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white border border-zinc-100 rounded-2xl p-6">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="mt-2.5 text-3xl font-bold text-zinc-900 tracking-tight">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

export default function Dashboard({ sessionId, onOpenSession, onAddTerminal }: DashboardProps) {
  const [terminals, setTerminals] = useState<ApiTerminal[]>([]);
  const [activeSession, setActiveSession] = useState<ApiSession | null>(null);
  const [tables, setTables] = useState<ApiTable[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    setLoading(true);
    Promise.all([
      getTerminals(token).catch(() => [] as ApiTerminal[]),
      getActiveSession(token),
      getTables(token).catch(() => [] as ApiTable[]),
      getOrders({}, token).catch(() => [] as ApiOrder[]),
    ]).then(([t, s, tbl, ord]) => {
      setTerminals(t);
      setActiveSession(s);
      setTables(tbl);
      setOrders(ord);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [sessionId]); // re-fetch when session changes

  // Compute real stats
  const occupiedTables = tables.filter((t) => t.status === 'Occupied' || t.status === 'Unpaid').length;
  const totalTables = tables.length;
  const activeOrders = orders.filter((o) => o.status === 'Open' || o.status === 'Sent');
  const revenue = orders
    .filter((o) => o.status !== 'Voided')
    .reduce((s, o) => s + parseFloat(String(o.total || '0')), 0);
  const avgOrder = activeOrders.length > 0 ? revenue / orders.filter(o => o.status !== 'Voided').length : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#fafaf8] p-6 md:p-8 space-y-6 font-sans text-zinc-900">

      {/* No session banner */}
      {!sessionId && !loading && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-900">No Active Session</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Open a session to start taking orders and processing payments.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSession}
            className="shrink-0 rounded-xl bg-amber-900 text-white text-xs font-semibold px-4 py-2.5 hover:bg-amber-800 transition-colors flex items-center gap-1.5"
          >
            <Plus size={13} />
            Open Session
          </button>
        </div>
      )}

      {/* Metrics */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-zinc-100" />)}
        </div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatCard
            dark
            label="Total Revenue (Session)"
            value={`₹ ${formatCurrency(revenue)}`}
            sub={`${orders.filter(o => o.status !== 'Voided').length} orders · avg ₹${formatCurrency(avgOrder)}`}
          />
          <StatCard
            label="Active Orders"
            value={String(activeOrders.length)}
            sub={`${orders.filter(o => o.status === 'Sent').length} in kitchen · ${orders.filter(o => o.status === 'Open').length} open`}
          />
          <StatCard
            label="Tables"
            value={totalTables > 0 ? `${occupiedTables} / ${totalTables}` : '—'}
            sub={totalTables > 0 ? `${Math.round((occupiedTables / totalTables) * 100)}% occupancy` : 'No tables yet'}
          />
        </section>
      )}

      {/* Active Session Card */}
      {activeSession && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Current Session</h3>
            <button onClick={loadData} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
              <RefreshCw size={11} />
              Refresh
            </button>
          </div>
          <div className="bg-white border border-zinc-100 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                  <CircleDot size={16} className="text-green-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-zinc-900">Session Active</p>
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                      {formatDuration(activeSession.startTime)} running
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Opened at {new Date(activeSession.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Opening Balance</p>
                <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                  ₹{parseFloat(String(activeSession.openingBalance)).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Terminals */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Terminals</h3>
          <button
            onClick={onAddTerminal}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <Plus size={12} />
            Add Terminal
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-zinc-100" />)}
          </div>
        ) : terminals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto mb-3">
              <Monitor size={18} className="text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-700">No terminals yet</p>
            <p className="text-xs text-zinc-400 mt-1">Open a session to create your first terminal.</p>
            <button
              onClick={onOpenSession}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 hover:bg-zinc-800 transition-colors"
            >
              <Plus size={13} />
              Open Session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {terminals.map((terminal) => (
              <article
                key={terminal.id}
                className="bg-white border border-zinc-100 rounded-2xl p-5 hover:border-zinc-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900">{terminal.name}</h4>
                    {terminal.location && (
                      <p className="text-[10px] text-zinc-400 mt-0.5">{terminal.location}</p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      terminal.isLocked ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {terminal.isLocked ? 'In Use' : 'Available'}
                  </span>
                </div>
                <button
                  onClick={onOpenSession}
                  className="w-full flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  {terminal.isLocked ? 'View Session' : 'Open Session'}
                  <ChevronRight size={13} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Recent Orders */}
      {orders.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Recent Orders</h3>
          <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
            {orders.slice(0, 6).map((order, i) => {
              const statusColors: Record<string, string> = {
                Open: 'bg-zinc-100 text-zinc-500',
                Sent: 'bg-blue-50 text-blue-700',
                Paid: 'bg-green-50 text-green-700',
                Voided: 'bg-red-50 text-red-600',
              };
              return (
                <div
                  key={order.id}
                  className={`flex items-center justify-between px-5 py-3 ${i < orders.length - 1 && i < 5 ? 'border-b border-zinc-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-zinc-500">{order.orderNumber}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusColors[order.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-zinc-400">{order.items?.length ?? 0} items</span>
                    <span className="text-sm font-semibold text-zinc-900">
                      ₹{parseFloat(String(order.total || '0')).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
