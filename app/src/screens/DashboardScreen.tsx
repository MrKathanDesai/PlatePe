import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Plus, X, TrendingUp, ShoppingBag, Layers, ChevronDown, ChevronUp, Minus, Trash2, Ban } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { reportsApi } from '../api/reports';
import { ordersApi } from '../api/orders';
import { sessionsApi } from '../api/sessions';
import { inventoryApi } from '../api/inventory';
import { getKDSSocket } from '../api/kds';
import type { DailyReport, Order, Terminal, InventoryItem } from '../types';

function todayISO() {  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function tomorrowISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            {label}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--text)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5 }}>{sub}</div>}
        </div>
        <div style={{ color: 'var(--accent)', opacity: 0.5, marginTop: 2 }}>{icon}</div>
      </div>
    </div>
  );
}

export default function DashboardScreen() {
  const { user, session, setSession, tables, showToast } = useApp();
  const [todayRows, setTodayRows] = useState<DailyReport[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [closingBalance, setClosingBalance] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    reportsApi.daily({ from: todayISO(), to: tomorrowISO() }).then((r) => setTodayRows(r.data)).catch(() => {});
  }, []);

  const loadRecentOrders = useCallback(() => {
    if (!session) {
      setRecentOrders([]);
      return;
    }

    ordersApi.getAll({ sessionId: session.id }).then((r) => setRecentOrders(r.data.slice(0, 8))).catch(() => {});
  }, [session]);

  useEffect(() => {
    fetchStats();
    inventoryApi.getLowStock().then((r) => setLowStock(r.data)).catch(() => {});
    sessionsApi.getTerminals().then((r) => setTerminals(r.data)).catch(() => {});
  }, [fetchStats]);

  useEffect(() => {
    loadRecentOrders();
  }, [loadRecentOrders]);

  useEffect(() => {
    const refresh = () => {
      fetchStats();
      loadRecentOrders();
    };

    const intervalId = window.setInterval(refresh, 15000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchStats, loadRecentOrders]);

  // Re-fetch stats whenever an order is paid
  useEffect(() => {
    const socket = getKDSSocket();
    const handler = () => {
      fetchStats();
      loadRecentOrders();
    };
    socket.on('order:paid', handler);
    return () => { socket.off('order:paid', handler); };
  }, [fetchStats, loadRecentOrders]);

  const occupiedCount = tables.filter((t) => t.status === 'Occupied').length;

  const handleOpenSession = async () => {
    if (!selectedTerminalId) return;
    setSessionLoading(true);
    try {
      const r = await sessionsApi.open({ terminalId: selectedTerminalId, openingBalance: parseFloat(openingBalance) || 0 });
      setSession(r.data);
      setShowSessionModal(false);
      showToast('Session opened');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Failed to open session');
    } finally {
      setSessionLoading(false);
    }
  };

  const handleCloseSession = async () => {
    if (!session) return;
    const bal = parseFloat(closingBalance);
    if (isNaN(bal)) { showToast('Enter closing balance'); return; }
    setSessionLoading(true);
    try {
      await sessionsApi.close(session.id, bal);
      setSession(null);
      showToast('Session closed');
    } catch {
      showToast('Failed to close session');
    } finally {
      setSessionLoading(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 1140 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          fontWeight: 300,
          color: 'var(--text)',
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          Good {getGreeting()}, <em>{user?.name?.split(' ')[0]}</em>
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 13, margin: '4px 0 0' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats row */}
      {(() => {
        const totalRevenue = todayRows.reduce((s, r) => s + Number(r.total), 0);
        const totalOrders = todayRows.reduce((s, r) => s + Number(r.orderCount), 0);
        const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        return (
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <StatCard icon={<TrendingUp size={20} />} label="Today's Revenue"
          value={`₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          sub={`${totalOrders} orders placed`}
        />
        <StatCard icon={<ShoppingBag size={20} />} label="Today's Avg Order Value"
          value={`₹${avgOrder.toFixed(0)}`}
        />
        <StatCard icon={<Layers size={20} />} label="Active Tables"
          value={`${occupiedCount} / ${tables.length}`}
          sub={`${tables.filter((t) => t.status === 'Available').length} available now`}
        />
      </div>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
        {/* Session */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Session</h2>
              <span className={`badge ${session ? 'badge-green' : 'badge-muted'}`}>
                {session?.status === 'ACTIVE' ? 'Open' : 'Closed'}
              </span>
            </div>

            {session?.status === 'ACTIVE' ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Opened</div>
                    <div style={{ fontSize: 14, color: 'var(--text)' }}>
                      {new Date(session.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>Opening Balance</div>
                    <div style={{ fontSize: 14, color: 'var(--text)' }}>₹{Number(session.openingBalance).toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" type="number" placeholder="Closing balance…"
                    value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-danger" onClick={handleCloseSession} disabled={sessionLoading} style={{ flexShrink: 0 }}>
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14, margin: '0 0 14px' }}>
                  No active session. Open one to start taking orders.
                </p>
                <button className="btn btn-primary" onClick={() => setShowSessionModal(true)}>
                  <Plus size={14} /> Open Session
                </button>
              </div>
            )}
          </div>

          {/* Low Stock */}
          {lowStock.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                <AlertTriangle size={14} color="var(--amber)" />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Low Stock</h2>
              </div>
              {lowStock.slice(0, 5).map((item) => (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{item.productName}</span>
                  <span className="badge badge-amber">{item.quantity} {item.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Recent Orders</h2>
          </div>
          {recentOrders.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '20px' }}>
              {session ? 'No orders yet this session.' : 'Open a session to start taking orders.'}
            </p>
          ) : (
            <div>
              {recentOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const isEditable = order.status === 'Open' || order.status === 'Sent';
                const nonVoidedItems = (order.items ?? []).filter((i) => i.status !== 'Voided');

                const handleVoidOrder = async () => {
                  if (!window.confirm(`Void order #${order.orderNumber}? This cannot be undone.`)) return;
                  setActionLoading(`void-${order.id}`);
                  try {
                    await ordersApi.void(order.id);
                    if (session) ordersApi.getAll({ sessionId: session.id }).then((r) => setRecentOrders(r.data.slice(0, 8))).catch(() => {});
                    fetchStats();
                    showToast('Order voided');
                  } catch { showToast('Failed to void order'); }
                  finally { setActionLoading(null); }
                };

                const handleVoidItem = async (itemId: string) => {
                  setActionLoading(`item-${itemId}`);
                  try {
                    await ordersApi.voidItem(order.id, itemId, 'Voided from dashboard');
                    if (session) ordersApi.getAll({ sessionId: session.id }).then((r) => setRecentOrders(r.data.slice(0, 8))).catch(() => {});
                  } catch { showToast('Failed to void item'); }
                  finally { setActionLoading(null); }
                };

                const handleUpdateQty = async (itemId: string, currentQty: number, delta: number) => {
                  const newQty = currentQty + delta;
                  setActionLoading(`item-${itemId}`);
                  try {
                    if (newQty <= 0) {
                      await ordersApi.removeItem(order.id, itemId);
                    } else {
                      await ordersApi.updateItemQty(order.id, itemId, newQty);
                    }
                    if (session) ordersApi.getAll({ sessionId: session.id }).then((r) => setRecentOrders(r.data.slice(0, 8))).catch(() => {});
                  } catch { showToast('Failed to update item'); }
                  finally { setActionLoading(null); }
                };

                return (
                  <div key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', cursor: 'pointer' }}
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>#{order.orderNumber}</span>
                      <span className={`badge ${getOrderBadge(order.status)}`}>{order.status}</span>
                      {order.tableId && (
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          T{tables.find((t) => t.id === order.tableId)?.number ?? order.tableId}
                        </span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        ₹{Number(order.total).toFixed(0)}
                      </span>
                      {isEditable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleVoidOrder(); }}
                          disabled={actionLoading === `void-${order.id}`}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, display: 'flex', alignItems: 'center' }}
                          title="Void order"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <span style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    </div>

                    {/* Expanded items */}
                    {isExpanded && (
                      <div style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)', padding: '10px 20px' }}>
                        {nonVoidedItems.length === 0 ? (
                          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>All items voided</p>
                        ) : nonVoidedItems.map((item) => {
                          const isItemLoading = actionLoading === `item-${item.id}`;
                          return (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                              <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{item.productName}</span>
                              {isEditable ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <button
                                    onClick={() => handleUpdateQty(item.id, item.quantity, -1)}
                                    disabled={isItemLoading}
                                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
                                    <Minus size={9} />
                                  </button>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 18, textAlign: 'center' }}>
                                    {isItemLoading ? '…' : item.quantity}
                                  </span>
                                  <button
                                    onClick={() => handleUpdateQty(item.id, item.quantity, 1)}
                                    disabled={isItemLoading}
                                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
                                    <Plus size={9} />
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>×{item.quantity}</span>
                              )}
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 48, textAlign: 'right' }}>
                                ₹{(Number(item.unitPrice) * item.quantity).toFixed(0)}
                              </span>
                              {isEditable && (
                                <button
                                  onClick={() => handleVoidItem(item.id)}
                                  disabled={isItemLoading}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2, display: 'flex', alignItems: 'center' }}
                                  title="Void item">
                                  <Ban size={11} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>      </div>

      {/* Session modal */}
      {showSessionModal && (
        <div className="modal-overlay">
          <div className="card" style={{ width: 400, padding: 28, position: 'relative' }}>
            <button onClick={() => setShowSessionModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, color: 'var(--text)', margin: '0 0 22px', letterSpacing: '-0.02em' }}>
              Open Session
            </h2>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Terminal</label>
              <select className="input" value={selectedTerminalId} onChange={(e) => setSelectedTerminalId(e.target.value)}>
                <option value="">Select terminal…</option>
                {terminals.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.isLocked && t.lockedByUserId !== user?.id}>
                    {t.name}{t.location ? ` (${t.location})` : ''}
                    {t.isLocked
                      ? t.lockedByUserId === user?.id
                        ? ' · Your active terminal'
                        : ` · In use${t.lockedByUserName ? ` by ${t.lockedByUserName}` : ''}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Opening Balance (₹)</label>
              <input className="input" type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} min="0" />
            </div>
            {terminals.some((t) => t.isLocked && t.lockedByUserId !== user?.id) && (
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
                Terminals already in use by someone else are shown as unavailable in the list.
              </p>
            )}
            {terminals.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 14 }}>No terminals found. Add one in Settings first.</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowSessionModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleOpenSession} disabled={!selectedTerminalId || sessionLoading}>
                {sessionLoading ? 'Opening…' : 'Open Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function getOrderBadge(status: string) {
  switch (status) {
    case 'Paid': return 'badge-green';
    case 'Sent': case 'Open': return 'badge-amber';
    case 'Voided': return 'badge-red';
    default: return 'badge-muted';
  }
}
