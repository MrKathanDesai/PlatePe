import React, { useState, useEffect, useCallback } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { reportsApi } from '../api/reports';
import { sessionsApi } from '../api/sessions';
import { getKDSSocket } from '../api/kds';
import type { DailyReport, ProductReport, AuditLog, HourlyHeatmap, Session, TableTurnoverReport } from '../types';

type Tab = 'Daily' | 'Products' | 'Audit' | 'Sessions' | 'Heatmap' | 'Turnover';
type ReportRange = 'today' | '7d' | '30d';


function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text)', fontWeight: 300, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function startOfPastDayISO(daysBackInclusive: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysBackInclusive);
  return d.toISOString();
}

function getRangeParams(range: ReportRange) {
  if (range === 'today') {
    return { from: startOfTodayISO(), to: endOfTodayISO() };
  }

  if (range === '7d') {
    return { from: startOfPastDayISO(6), to: endOfTodayISO() };
  }

  return { from: startOfPastDayISO(29), to: endOfTodayISO() };
}

function getRangeLabel(range: ReportRange) {
  switch (range) {
    case 'today': return 'Today';
    case '7d': return '7D';
    case '30d': return '30D';
    default: return '30D';
  }
}

function getRangeTitle(range: ReportRange) {
  switch (range) {
    case 'today': return 'Today';
    case '7d': return 'Last 7 Days';
    case '30d': return 'Last 30 Days';
    default: return 'Last 30 Days';
  }
}

function DailyTab({ range }: { range: ReportRange }) {
  const [rows, setRows] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    try {
      const r = await reportsApi.daily(getRangeParams(range));
      setRows(r.data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    const socket = getKDSSocket();
    socket.on('order:paid', fetchRows);
    return () => { socket.off('order:paid', fetchRows); };
  }, [fetchRows]);
  if (loading) return <div style={{ color: 'var(--text-3)', padding: 16 }}>Loading…</div>;
  if (!rows.length) return <div style={{ color: 'var(--text-3)', padding: 16 }}>No data yet — complete and pay some orders first.</div>;

  const totalRevenue = rows.reduce((s, r) => s + Number(r.total), 0);
  const totalOrders  = rows.reduce((s, r) => s + Number(r.orderCount), 0);
  const avgOrder     = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Chart data: last 14 days sorted ascending
  const chartData = [...rows].sort((a, b) => a.date.localeCompare(b.date)).slice(-14).map((r) => ({
    date: new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    revenue: Math.round(Number(r.total)),
    orders: Number(r.orderCount),
  }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <MetricCard label={`Revenue (${getRangeLabel(range)})`}   value={`₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
        <MetricCard label={`Orders (${getRangeLabel(range)})`}    value={`${totalOrders}`} />
        <MetricCard label={`Avg Order Value (${getRangeLabel(range)})`} value={`₹${avgOrder.toFixed(0)}`} />
      </div>
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Revenue — {getRangeTitle(range)}</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, boxShadow: 'var(--shadow-md)' }}
              formatter={(v) => [`₹${Number(v ?? 0).toLocaleString('en-IN')}`, 'Revenue']}
            />
            <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="card" style={{ marginTop: 20, padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Orders</th><th style={{ textAlign: 'right' }}>Subtotal</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Discount</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
          <tbody>
            {[...rows].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
              <tr key={r.date}>
                <td>{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                <td style={{ textAlign: 'right' }}>{r.orderCount}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>₹{Number(r.subtotal).toFixed(0)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-3)' }}>₹{Number(r.tax).toFixed(0)}</td>
                <td style={{ textAlign: 'right', color: 'var(--green)' }}>{Number(r.discount) > 0 ? `−₹${Number(r.discount).toFixed(0)}` : '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>₹{Number(r.total).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductsTab({ range }: { range: ReportRange }) {
  const [products, setProducts] = useState<ProductReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      try {
        const r = await reportsApi.products(getRangeParams(range));
        if (!cancelled) setProducts(r.data);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProducts();
    return () => { cancelled = true; };
  }, [range]);

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 16 }}>Loading…</div>;
  const maxRev = Math.max(...products.map((p) => p.revenue), 1);
  return (
    <div>
      <div className="card">
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>Showing top products for {getRangeTitle(range).toLowerCase()}.</div>
        <div style={{ marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={products.slice(0, 10)} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, boxShadow: 'var(--shadow-md)' }}
                formatter={(v) => [`₹${Number(v ?? 0).toFixed(0)}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="data-table">
          <thead><tr><th>#</th><th>Product</th><th>Qty Sold</th><th style={{ textAlign: 'right' }}>Revenue</th></tr></thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.productId}>
                <td style={{ color: 'var(--text-3)', fontWeight: 600 }}>#{i + 1}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--surface-3)', marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${(p.revenue / maxRev) * 100}%`, opacity: 0.6 }} />
                  </div>
                </td>
                <td>{p.totalQty}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>₹{Number(p.revenue).toFixed(0)}</td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No data yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    reportsApi.audit({ limit: 50 }).then((r) => setLogs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  if (loading) return <div style={{ color: 'var(--text-3)', padding: 16 }}>Loading…</div>;
  return (
    <div className="card">
      <table className="data-table">
        <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th></tr></thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                {new Date(log.timestamp).toLocaleTimeString('en-IN')}
              </td>
              <td style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 12 }}>{log.actorId?.slice(0, 8) ?? 'system'}</td>
              <td><span className="badge badge-accent">{log.action}</span></td>
              <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {log.entityType} · <span style={{ fontFamily: 'monospace' }}>{log.entityId?.slice(0, 8)}</span>
              </td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No audit logs</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HeatmapTab({ range }: { range: ReportRange }) {
  const [data, setData] = useState<HourlyHeatmap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadHeatmap = async () => {
      try {
        const r = await reportsApi.hourlyHeatmap(getRangeParams(range));
        if (!cancelled) setData(r.data);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadHeatmap();
    return () => { cancelled = true; };
  }, [range]);

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 16 }}>Loading…</div>;
  const maxCount = Math.max(...data.map((d) => d.orderCount), 1);
  // Build a 7×48 grid (day × 30-min slot)
  const grid: Record<string, number> = {};
  data.forEach((d) => { grid[`${d.dayOfWeek}-${d.slot}`] = d.orderCount; });
  const hours = Array.from({ length: 48 }, (_, i) => i);
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Orders by Hour & Day ({getRangeTitle(range)})</div>
      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(48, 1fr)`, gap: 2, minWidth: 900 }}>
        {/* Header row */}
        <div />
        {hours.map((slot) => (
          <div key={slot} style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center', padding: '2px 0' }}>
            {slot % 2 === 0 ? `${Math.floor(slot / 2)}h` : ''}
          </div>
        ))}
        {DAY_NAMES.map((day, di) => (
          <React.Fragment key={day}>
            <div style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', paddingRight: 6, justifyContent: 'flex-end' }}>{day}</div>
            {hours.map((slot) => {
              const count = grid[`${di}-${slot}`] ?? 0;
              const intensity = count / maxCount;
              return (
                <div key={slot} title={`${count} orders`} style={{
                  height: 18, borderRadius: 2,
                  background: count === 0 ? 'var(--surface-2)' : `rgba(201,137,90,${0.15 + intensity * 0.85})`,
                  border: '1px solid var(--border)',
                }} />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 11, color: 'var(--text-3)' }}>
        <span>Low</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((i) => (
          <div key={i} style={{ width: 18, height: 12, borderRadius: 2, background: `rgba(201,137,90,${0.15 + i * 0.85})`, border: '1px solid var(--border)' }} />
        ))}
        <span>High</span>
      </div>
    </div>
  );
}

function SessionsTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    totalOrders: number; paidOrders: number; voidedOrders: number;
    totalRevenue: number; paymentBreakdown: { method: string; total: number }[];
    discrepancy: number;
  } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    sessionsApi.getAll().then((r) => setSessions(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadSummary = async (id: string) => {
    if (selected === id) { setSelected(null); setSummary(null); return; }
    setSelected(id); setLoadingSummary(true);
    try {
      const r = await reportsApi.session(id);
      setSummary(r.data);
    } catch { setSummary(null); }
    finally { setLoadingSummary(false); }
  };

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 16 }}>Loading…</div>;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="data-table">
        <thead><tr><th>Terminal</th><th>Opened</th><th>Closed</th><th>Opening Bal</th><th>Closing Bal</th><th>Status</th></tr></thead>
        <tbody>
          {sessions.map((s) => (
            <React.Fragment key={s.id}>
              <tr style={{ cursor: 'pointer' }} onClick={() => loadSummary(s.id)}>
                <td style={{ fontWeight: 600 }}>{s.terminal?.name ?? '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(s.startTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.closingBalance != null ? new Date(s.startTime).toLocaleDateString('en-IN') : '—'}</td>
                <td>₹{Number(s.openingBalance).toFixed(0)}</td>
                <td>{s.closingBalance != null ? `₹${Number(s.closingBalance).toFixed(0)}` : '—'}</td>
                <td><span className={`badge ${s.status === 'ACTIVE' ? 'badge-green' : 'badge-muted'}`}>{s.status}</span></td>
              </tr>
              {selected === s.id && (
                <tr>
                  <td colSpan={6} style={{ background: 'var(--surface-2)', padding: 18 }}>
                    {loadingSummary ? (
                      <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading summary…</span>
                    ) : summary ? (
                      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 13 }}>
                        {[
                          ['Revenue', `₹${Number(summary.totalRevenue).toFixed(0)}`],
                          ['Orders', String(summary.totalOrders)],
                          ['Paid', String(summary.paidOrders)],
                          ['Voided', String(summary.voidedOrders)],
                          ['Discrepancy', `₹${Number(summary.discrepancy).toFixed(0)}`],
                        ].map(([label, val]) => (
                          <div key={label}>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{val}</div>
                          </div>
                        ))}
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Payment Mix</div>
                          <div style={{ display: 'flex', gap: 10 }}>
                            {summary.paymentBreakdown.map((p) => (
                              <span key={p.method} style={{ color: 'var(--text-2)' }}>{p.method} ₹{Number(p.total).toFixed(0)}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : <span style={{ color: 'var(--text-3)', fontSize: 13 }}>No data</span>}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {sessions.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No sessions yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TurnoverTab({ range }: { range: ReportRange }) {
  const [data, setData] = useState<TableTurnoverReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadTurnover = async () => {
      try {
        const r = await reportsApi.tableTurnover(getRangeParams(range));
        if (!cancelled) setData(r.data);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadTurnover();
    return () => { cancelled = true; };
  }, [range]);

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 16 }}>Loading…</div>;
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="data-table">
        <thead><tr><th>Table</th><th style={{ textAlign: 'right' }}>Turnovers</th><th style={{ textAlign: 'right' }}>Avg Duration</th></tr></thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.tableId}>
              <td style={{ fontWeight: 600 }}>
                {row.tableName && row.tableName !== row.tableId ? row.tableName : row.tableId}
              </td>
              <td style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }}>{row.turnovers}</td>
              <td style={{ textAlign: 'right', color: 'var(--text-3)', fontSize: 12 }}>{Math.round(row.avgMinutes)} min</td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 32 }}>No data yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportingScreen() {
  const [tab, setTab] = useState<Tab>('Daily');
  const [range, setRange] = useState<ReportRange>('30d');
  const supportsRange = tab === 'Daily' || tab === 'Products' || tab === 'Heatmap' || tab === 'Turnover';
  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 300, color: 'var(--text)', margin: '0 0 22px', letterSpacing: '-0.02em' }}>
        Reports
      </h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap' }}>
        {(['Daily', 'Products', 'Audit', 'Sessions', 'Heatmap', 'Turnover'] as Tab[]).map((t) => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 13 }} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {supportsRange && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {([
            ['today', 'Today'],
            ['7d', 'Last 7D'],
            ['30d', 'Last 30D'],
          ] as [ReportRange, string][]).map(([value, label]) => (
            <button key={value} className={`btn ${range === value ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 12 }} onClick={() => setRange(value)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {tab === 'Daily'    && <DailyTab key={`daily-${range}`} range={range} />}
      {tab === 'Products' && <ProductsTab key={`products-${range}`} range={range} />}
      {tab === 'Audit'    && <AuditTab />}
      {tab === 'Sessions' && <SessionsTab />}
      {tab === 'Heatmap'  && <HeatmapTab key={`heatmap-${range}`} range={range} />}
      {tab === 'Turnover' && <TurnoverTab key={`turnover-${range}`} range={range} />}
    </div>
  );
}
