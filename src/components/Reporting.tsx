import { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2, TrendingUp, ShoppingBag, BarChart2, Star } from 'lucide-react';
import {
  getReportingDaily,
  getReportingProducts,
  getReportingAudit,
  getOrders,
  ApiDailySummary,
  ApiProductPerformance,
  ApiAuditEntry,
  ApiOrder,
  getToken,
} from '../api';

interface ReportingProps {
  userRole: string;
}

function fmt(value: number) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function actionColor(action: string) {
  const a = action.toLowerCase();
  if (a.includes('void')) return 'bg-red-50 text-red-600';
  if (a.includes('refund')) return 'bg-orange-50 text-orange-600';
  if (a.includes('discount')) return 'bg-blue-50 text-blue-600';
  if (a.includes('split')) return 'bg-violet-50 text-violet-600';
  return 'bg-zinc-100 text-zinc-600';
}

export default function Reporting({ userRole }: ReportingProps) {
  const isAdmin = userRole === 'Admin' || userRole === 'Manager';

  const [dailyData, setDailyData] = useState<ApiDailySummary[]>([]);
  const [products, setProducts] = useState<ApiProductPerformance[]>([]);
  const [auditLog, setAuditLog] = useState<ApiAuditEntry[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();

    const promises: Promise<unknown>[] = [
      getOrders({}, token).catch(() => [] as ApiOrder[]),
    ];

    if (isAdmin) {
      promises.push(
        getReportingDaily(token, { from, to }).catch(() => [] as ApiDailySummary[]),
        getReportingProducts(token, { from, to }).catch(() => [] as ApiProductPerformance[]),
        getReportingAudit(token).catch(() => [] as ApiAuditEntry[]),
      );
    }

    Promise.all(promises)
      .then(([ord, daily, prods, audit]) => {
        setOrders(ord as ApiOrder[]);
        if (isAdmin) {
          setDailyData((daily as ApiDailySummary[]) ?? []);
          setProducts((prods as ApiProductPerformance[]) ?? []);
          setAuditLog(((audit as ApiAuditEntry[]) ?? []).slice(0, 30));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  // Derive stats from real orders (all non-voided)
  const nonVoided = orders.filter((o) => o.status !== 'Voided');
  const paidOrders = orders.filter((o) => o.status === 'Paid');
  const totalRevenue = nonVoided.reduce((s, o) => s + parseFloat(String(o.total || '0')), 0);
  const avgOrder = nonVoided.length > 0 ? totalRevenue / nonVoided.length : 0;

  // Build chart from daily reporting data, or from orders if empty
  const chartData: { day: string; sales: number }[] = dailyData.length > 0
    ? dailyData.slice().reverse().map((d) => ({
        day: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        sales: Math.round(parseFloat(d.total || '0')),
      }))
    : (() => {
        // Build per-day buckets from the orders we have
        const buckets: Record<string, number> = {};
        nonVoided.forEach((o) => {
          if (!o.createdAt) return;
          const day = new Date(o.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
          buckets[day] = (buckets[day] ?? 0) + parseFloat(String(o.total || '0'));
        });
        return Object.entries(buckets).map(([day, sales]) => ({ day, sales }));
      })();

  const topItems = products.length > 0
    ? products.slice(0, 8).map((p) => ({
        name: p.name,
        qty: parseInt(p.totalQty, 10),
        revenue: Math.round(parseFloat(p.revenue)),
      }))
    : (() => {
        // Derive top items from line items in orders
        const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
        nonVoided.forEach((o) => {
          (o.items ?? []).forEach((item) => {
            if (item.status === 'Voided') return;
            if (!itemMap[item.productId]) {
              itemMap[item.productId] = { name: item.productName, qty: 0, revenue: 0 };
            }
            itemMap[item.productId].qty += item.quantity;
            itemMap[item.productId].revenue += item.unitPrice * item.quantity;
          });
        });
        return Object.values(itemMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 8);
      })();

  const stats = [
    {
      label: 'Total Revenue',
      value: `₹${fmt(totalRevenue)}`,
      sub: paidOrders.length > 0 ? `${paidOrders.length} paid` : `${nonVoided.length} orders (none paid yet)`,
      icon: <TrendingUp size={15} className="text-emerald-600" />,
      bg: 'bg-emerald-50',
    },
    {
      label: 'Total Orders',
      value: String(orders.length),
      sub: `${orders.filter(o => o.status === 'Sent').length} in kitchen · ${orders.filter(o => o.status === 'Open').length} open`,
      icon: <ShoppingBag size={15} className="text-blue-600" />,
      bg: 'bg-blue-50',
    },
    {
      label: 'Avg Order Value',
      value: nonVoided.length > 0 ? `₹${fmt(avgOrder)}` : '—',
      sub: nonVoided.length > 0 ? `across ${nonVoided.length} orders` : 'No orders yet',
      icon: <BarChart2 size={15} className="text-violet-600" />,
      bg: 'bg-violet-50',
    },
    {
      label: 'Top Item',
      value: topItems[0]?.name ?? '—',
      sub: topItems[0] ? `${topItems[0].qty} sold · ₹${fmt(topItems[0].revenue)}` : 'No sales yet',
      icon: <Star size={15} className="text-amber-600" />,
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#fafaf8] p-6 md:p-8">
      <div className="mx-auto max-w-[1400px] space-y-6">

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Loader2 size={18} className="animate-spin text-zinc-400" />
            <p className="text-sm text-zinc-500">Loading reports…</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-zinc-100 bg-white p-5">
                  <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                    {s.icon}
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 truncate">{s.value}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">{s.sub}</p>
                </div>
              ))}
            </section>

            {/* Chart + Top Items */}
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-zinc-100 bg-white p-6 xl:col-span-2">
                <h2 className="text-sm font-semibold text-zinc-900 mb-6">Revenue — Last 7 Days</h2>
                {chartData.length === 0 ? (
                  <div className="flex h-[240px] items-center justify-center">
                    <p className="text-sm text-zinc-400">No completed orders yet</p>
                  </div>
                ) : (
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="day"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#a1a1aa', fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#a1a1aa', fontSize: 11 }}
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                          width={40}
                        />
                        <Tooltip
                          cursor={{ stroke: '#e4e4e7', strokeWidth: 1 }}
                          contentStyle={{
                            border: '1px solid #e4e4e7',
                            borderRadius: '10px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                            fontSize: '12px',
                            padding: '6px 12px',
                          }}
                          formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']}
                        />
                        <Area type="monotone" dataKey="sales" stroke="#16a34a" strokeWidth={2} fill="url(#revGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-100 bg-white p-6">
                <h2 className="text-sm font-semibold text-zinc-900 mb-4">Top Items</h2>
                {topItems.length === 0 ? (
                  <div className="flex h-[200px] items-center justify-center">
                    <p className="text-sm text-zinc-400">No items sold yet</p>
                  </div>
                ) : (
                  <div>
                    {topItems.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3 border-b border-zinc-50 py-2.5 last:border-0">
                        <span className="w-4 shrink-0 text-[10px] font-bold text-zinc-300">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-zinc-800 truncate">{item.name}</p>
                          <p className="text-[10px] text-zinc-400">{item.qty}× sold</p>
                        </div>
                        <span className="text-[13px] font-semibold text-zinc-900">₹{fmt(item.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Audit Trail — Admin/Manager only */}
            {isAdmin && (
              <section className="rounded-2xl border border-zinc-100 bg-white p-6">
                <h2 className="text-sm font-semibold text-zinc-900 mb-4">Audit Trail</h2>
                {auditLog.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <p className="text-sm text-zinc-400">No audit events yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left">
                      <thead>
                        <tr>
                          {['Action', 'Actor', 'Order', 'Amount', 'Reason', 'Time'].map((h) => (
                            <th key={h} className="pb-2.5 pr-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {auditLog.map((entry) => (
                          <tr key={entry.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="py-2.5 pr-4">
                              <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${actionColor(entry.action)}`}>
                                {entry.action}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-[13px] text-zinc-700">{entry.actorName || '—'}</td>
                            <td className="py-2.5 pr-4 font-mono text-[12px] text-zinc-500">
                              {entry.orderId ? `#${entry.orderId.slice(-6)}` : '—'}
                            </td>
                            <td className="py-2.5 pr-4 text-[13px] text-zinc-700">
                              {entry.amount != null ? `₹${fmt(entry.amount)}` : '—'}
                            </td>
                            <td className="py-2.5 pr-4 text-[13px] text-zinc-500 max-w-[180px] truncate">{entry.reason || '—'}</td>
                            <td className="py-2.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                              {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Orders table — live view */}
            <section className="rounded-2xl border border-zinc-100 bg-white p-6">
              <h2 className="text-sm font-semibold text-zinc-900 mb-4">All Orders</h2>
              {orders.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <p className="text-sm text-zinc-400">No orders yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left">
                    <thead>
                      <tr>
                        {['Order #', 'Status', 'Items', 'Subtotal', 'Tax', 'Total', 'Time'].map((h) => (
                          <th key={h} className="pb-2.5 pr-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {orders.map((o) => {
                        const statusColor: Record<string, string> = {
                          Open: 'bg-zinc-100 text-zinc-500',
                          Sent: 'bg-blue-50 text-blue-700',
                          Paid: 'bg-green-50 text-green-700',
                          Voided: 'bg-red-50 text-red-600',
                        };
                        return (
                          <tr key={o.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="py-2.5 pr-4 font-mono text-[12px] text-zinc-700">{o.orderNumber}</td>
                            <td className="py-2.5 pr-4">
                              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusColor[o.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-[13px] text-zinc-600">{o.items?.length ?? 0}</td>
                            <td className="py-2.5 pr-4 text-[13px] text-zinc-700">₹{fmt(parseFloat(String(o.subtotal || 0)))}</td>
                            <td className="py-2.5 pr-4 text-[13px] text-zinc-500">₹{fmt(parseFloat(String(o.tax || 0)))}</td>
                            <td className="py-2.5 pr-4 text-[13px] font-semibold text-zinc-900">₹{fmt(parseFloat(String(o.total || 0)))}</td>
                            <td className="py-2.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                              {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
