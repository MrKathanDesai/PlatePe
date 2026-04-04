import { useEffect, useState, useCallback } from 'react';
import { CreditCard, RefreshCw } from 'lucide-react';
import { useApp } from '../store/app-store-context';
import { ordersApi } from '../api/orders';
import type { Order } from '../types';

function timeSince(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function CashierQueueScreen() {
  const { tables, navigate, setActiveOrder, session, showToast } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await ordersApi.getAll({ status: 'Sent' });
      setOrders(r.data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 20s
  useEffect(() => {
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  const handleProcess = async (order: Order) => {
    if (!session) { showToast('Open a session first'); return; }
    setActiveOrder(order);
    navigate('Payment');
  };

  const totalPending = orders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div style={{ padding: '28px 32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.04em' }}>
            Payment Queue
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, margin: '4px 0 0' }}>
            {orders.length} order{orders.length !== 1 ? 's' : ''} waiting · ₹{totalPending.toFixed(0)} total
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}>
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading…</div>
      ) : orders.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
          <CreditCard size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>No orders waiting for payment.</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Queue refreshes every 20 seconds.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, overflowY: 'auto' }}>
          {orders.map((order) => {
            const table = tables.find((t) => t.id === order.tableId);
            return (
              <div key={order.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.04em' }}>
                      {table ? `Table ${table.number}` : 'Takeaway'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      #{order.orderNumber} · {timeSince(order.createdAt)}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 22, color: 'var(--text)', fontWeight: 700 }}>
                    ₹{Number(order.total).toFixed(0)}
                  </div>
                </div>

                <div style={{ flex: 1, marginBottom: 14 }}>
                  {order.items?.filter((i) => i.status !== 'Voided').slice(0, 4).map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <span style={{ color: 'var(--text)' }}>{item.quantity}× {item.productName}</span>
                      <span style={{ color: 'var(--text-3)' }}>₹{(Number(item.unitPrice) * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                  {(order.items?.filter((i) => i.status !== 'Voided').length ?? 0) > 4 && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', paddingTop: 5 }}>
                      +{(order.items?.filter((i) => i.status !== 'Voided').length ?? 0) - 4} more items
                    </div>
                  )}
                </div>

                <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={() => handleProcess(order)}>
                  <CreditCard size={14} /> Process Payment
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
