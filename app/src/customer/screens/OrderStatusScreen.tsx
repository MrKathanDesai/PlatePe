import { useEffect, useState, useCallback } from 'react';
import { LogOut } from 'lucide-react';
import { customerApi } from '../api/customerApi';
import { useCustomer } from '../CustomerContext';
import { getKDSSocket } from '../../api/kds';

const STATUS_STEPS = ['Open', 'Sent', 'Ready', 'Paid'] as const;
const AUTO_LOGOUT_MS = 2500;
type CustomerDisplayStatus = typeof STATUS_STEPS[number];

function stepIndex(status: CustomerDisplayStatus) {
  const idx = STATUS_STEPS.indexOf(status);
  return idx === -1 ? 0 : idx;
}

function deriveDisplayStatus(
  order: {
    status: string;
    items: { status: string }[];
  } | null,
  fallbackStatus: string | null,
): CustomerDisplayStatus {
  const rawStatus = order?.status ?? fallbackStatus ?? 'Open';
  if (rawStatus === 'Paid') return 'Paid';

  const activeItems = (order?.items ?? []).filter((item) => item.status !== 'Voided');
  if (!activeItems.length) {
    return rawStatus === 'Sent' ? 'Sent' : 'Open';
  }

  if (activeItems.every((item) => item.status === 'Done')) {
    return 'Ready';
  }

  const hasStartedPrep = activeItems.some((item) => item.status === 'Sent' || item.status === 'Done');
  return hasStartedPrep || rawStatus === 'Sent' ? 'Sent' : 'Open';
}

export default function OrderStatusScreen() {
  const { orderId, orderNumber, orderStatus, orderTotal, setOrderStatus, setScreen, clearCart, logout, tableNumber } = useCustomer();
  const [order, setOrder] = useState<{
    id: string;
    orderNumber: string;
    status: string;
    subtotal: number;
    tax: number;
    total: number;
    items: { id: string; productName: string; quantity: number; unitPrice: number; status: string; modifiers: { name: string; price: number }[] }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    try {
      const o = await customerApi.getOrder(orderId);
      setOrder(o as any);
      setOrderStatus(o.status);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [orderId, setOrderStatus]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const status = deriveDisplayStatus(order, orderStatus);
  const step = stepIndex(status);
  const isPaid = status === 'Paid';
  const canSettleBill = status === 'Ready';
  const billTotal = Number(order?.total ?? orderTotal ?? 0);

  useEffect(() => {
    if (!orderId || isPaid) return;
    const socket = getKDSSocket();

    const handlePaid = (data: { orderId: string }) => {
      if (data.orderId !== orderId) return;
      setOrder((prev) => (prev ? { ...prev, status: 'Paid' } : prev));
      setOrderStatus('Paid');
      setLoading(false);
    };

    const handleStage = (ticket: { orderId: string }) => {
      if (ticket.orderId !== orderId) return;
      refresh();
    };

    const pollId = window.setInterval(() => {
      void refresh();
    }, 10000);

    socket.on('order:paid', handlePaid);
    socket.on('ticket:stage', handleStage);

    return () => {
      window.clearInterval(pollId);
      socket.off('order:paid', handlePaid);
      socket.off('ticket:stage', handleStage);
    };
  }, [isPaid, orderId, refresh, setOrderStatus]);

  useEffect(() => {
    if (!isPaid) return;
    const timeoutId = window.setTimeout(() => {
      logout();
    }, AUTO_LOGOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isPaid, logout]);

  function handlePayNow() {
    setScreen('payment');
  }

  function handleAddMore() {
    clearCart();
    setScreen('menu');
  }

  if (loading) return (
    <div style={styles.page}>
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p style={{ color: 'var(--text-2)', marginTop: 16 }}>Loading order…</p>
      </div>
    </div>
  );

  if (!orderId) {
    return (
      <div style={styles.page}>
        <div style={styles.centered}>
          <div style={styles.paidIcon}>✓</div>
          <h2 style={styles.statusHeading}>Session closed</h2>
          <p style={styles.statusSub}>Your payment is complete. Returning to sign in…</p>
          <button style={{ ...styles.payBtn, maxWidth: 280 }} onClick={logout}>
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.brand}>PlatePe</span>
        <div style={styles.headerActions}>
          {tableNumber && <span style={styles.tableChip}>Table {tableNumber}</span>}
          <span style={styles.orderNum}>{order?.orderNumber ?? orderNumber}</span>
          <button style={styles.logoutBtn} onClick={logout}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <div style={styles.content}>
        {/* Status card */}
        <div style={styles.statusCard}>
          {isPaid ? (
            <>
              <div style={styles.paidIcon}>✓</div>
              <h2 style={{ ...styles.statusHeading, color: '#276749' }}>Payment Confirmed!</h2>
              <p style={styles.statusSub}>Thank you for dining with us. You will be logged out automatically in a moment.</p>
            </>
          ) : (
            <>
              <div style={styles.pulseRing}>
                <span style={styles.statusEmoji}>
                  {status === 'Open' ? 'Open' : status === 'Sent' ? 'Preparing' : 'Ready'}
                </span>
              </div>
              <h2 style={styles.statusHeading}>
                {status === 'Open' ? 'Order Received' : status === 'Sent' ? 'Being Prepared' : 'Ready to Serve!'}
              </h2>
              <p style={styles.statusSub}>
                {status === 'Open' && 'Your order has been placed successfully and is heading to the kitchen.'}
                {status === 'Sent' && 'The kitchen is working on your order.'}
                {status === 'Ready' && 'Your meal is ready. You can settle the bill whenever you are done.'}
              </p>
            </>
          )}

          {/* Progress bar */}
          <div style={styles.progressContainer}>
            {STATUS_STEPS.slice(0, -1).map((s, i) => (
              <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  {i > 0 && <div style={{ flex: 1, height: 2, background: i <= step ? 'var(--accent)' : '#DDD8D0' }} />}
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: i <= step ? 'var(--accent)' : 'var(--surface-2)',
                    border: `2px solid ${i <= step ? 'var(--accent)' : '#DDD8D0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: i <= step ? '#fff' : 'var(--text-3)',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  {i < STATUS_STEPS.length - 2 && <div style={{ flex: 1, height: 2, background: i < step ? 'var(--accent)' : '#DDD8D0' }} />}
                </div>
                <span style={{ fontSize: 10, color: i <= step ? 'var(--accent)' : 'var(--text-3)', fontWeight: i <= step ? 600 : 400 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Order items */}
        {order && (
          <div style={styles.itemsCard}>
            <h3 style={styles.itemsTitle}>Order Details</h3>
            {order.items.map((item) => (
              <div key={item.id} style={styles.itemRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {item.quantity}× {item.productName}
                  </div>
                  {item.modifiers.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                      {item.modifiers.map((m) => m.name).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius)',
                    background: item.status === 'Done' ? 'rgba(39,103,73,0.10)' : item.status === 'Sent' ? 'rgba(146,88,10,0.08)' : 'rgba(59,95,190,0.08)',
                    color: item.status === 'Done' ? '#276749' : item.status === 'Sent' ? '#92580A' : '#3B5FBE',
                  }}>
                    {item.status === 'Done' ? 'Ready' : item.status}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>₹{(item.unitPrice * item.quantity).toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {(order || orderTotal !== null) && (
          <div style={styles.billCard}>
            <div style={styles.billHeader}>
              <h3 style={styles.itemsTitle}>Bill</h3>
              <span style={{
                ...styles.billTag,
                background: isPaid
                  ? 'rgba(39,103,73,0.10)'
                  : canSettleBill
                    ? 'rgba(196,98,45,0.10)'
                    : 'rgba(59,95,190,0.08)',
                color: isPaid
                  ? '#276749'
                  : canSettleBill
                    ? 'var(--accent)'
                    : '#3B5FBE',
              }}>
                {isPaid ? 'Paid' : canSettleBill ? 'Ready to settle' : 'Pay at the end'}
              </span>
            </div>

            <div style={styles.billSummary}>
              <div style={styles.billRow}><span>Subtotal</span><span>₹{Number(order?.subtotal ?? 0).toFixed(2)}</span></div>
              <div style={styles.billRow}><span>GST (5%)</span><span>₹{Number(order?.tax ?? 0).toFixed(2)}</span></div>
              <div style={{ ...styles.billRow, fontWeight: 700, fontSize: 16, borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                <span>Total</span><span>₹{billTotal.toFixed(2)}</span>
              </div>
            </div>

            {!isPaid && (
              <>
                <p style={styles.billHelp}>
                  {canSettleBill
                    ? 'Your order is complete. Settle the bill whenever you are ready.'
                    : 'No upfront payment needed. We will keep the bill open until your meal is finished.'}
                </p>
                <button
                  style={{ ...styles.payBtn, marginTop: 0, opacity: canSettleBill ? 1 : 0.55 }}
                  onClick={handlePayNow}
                  disabled={!canSettleBill}
                >
                  {canSettleBill ? `Settle Bill ₹${billTotal.toFixed(0)}` : 'Settle Bill After Service'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        {!isPaid && (
          <div style={styles.actions}>
            <button style={styles.addMoreBtn} onClick={handleAddMore}>
              + Add More Items
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "var(--font-ui)",
    maxWidth: 480,
    margin: '0 auto',
  },
  centered: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #DDD8D0',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    background: 'var(--surface)',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brand: {
    fontFamily: "var(--font-ui)",
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--accent)',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  tableChip: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-2)',
    background: 'var(--surface-2)',
    padding: '4px 10px',
    borderRadius: 'var(--radius)',
  },
  orderNum: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-2)',
    background: 'var(--surface-2)',
    padding: '4px 10px',
    borderRadius: 'var(--radius)',
  },
  logoutBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid #E0D7CB',
    background: 'var(--surface)',
    color: 'var(--text-2)',
    borderRadius: 'var(--radius)',
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "var(--font-ui)",
  },
  content: {
    flex: 1,
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  statusCard: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px 20px 20px',
    boxShadow: '0 1px 4px rgba(28,24,20,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  paidIcon: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#276749',
    color: '#fff',
    fontSize: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    fontWeight: 700,
  },
  pulseRing: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'rgba(196,98,45,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    animation: 'pulse 2s ease-in-out infinite',
  },
  statusEmoji: { fontSize: 36 },
  statusHeading: {
    fontFamily: "var(--font-ui)",
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 6px',
    letterSpacing: '-0.01em',
  },
  statusSub: { fontSize: 13, color: 'var(--text-2)', margin: '0 0 24px' },
  progressContainer: {
    display: 'flex',
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  itemsCard: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(28,24,20,0.06)',
  },
  billCard: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(28,24,20,0.06)',
  },
  itemsTitle: {
    fontFamily: "var(--font-ui)",
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 14px',
  },
  billHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  billTag: {
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid var(--surface-2)',
    gap: 12,
  },
  billSummary: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  billRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-2)' },
  billHelp: {
    fontSize: 13,
    color: 'var(--text-2)',
    lineHeight: 1.55,
    margin: '16px 0 14px',
  },
  actions: { display: 'flex', flexDirection: 'column', gap: 10 },
  payBtn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    padding: '16px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 4px 16px rgba(196,98,45,0.30)',
    fontFamily: "var(--font-ui)",
  },
  addMoreBtn: {
    background: 'var(--surface)',
    color: 'var(--accent)',
    border: '1.5px solid var(--accent)',
    borderRadius: 14,
    padding: '13px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    fontFamily: "var(--font-ui)",
  },
};
