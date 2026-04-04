import { useEffect, useState, useCallback } from 'react';
import { customerApi } from '../api/customerApi';
import { useCustomer } from '../CustomerContext';
import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_API_URL ?? '';

const STATUS_STEPS = ['Open', 'Sent', 'Ready', 'Paid'];

function stepIndex(status: string) {
  const idx = STATUS_STEPS.indexOf(status);
  return idx === -1 ? 0 : idx;
}

export default function OrderStatusScreen() {
  const { orderId, orderNumber, orderStatus, orderTotal, setOrderStatus, setScreen } = useCustomer();
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
    if (!orderId) return;
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

  useEffect(() => {
    if (!orderId) return;
    const socket: Socket = io(WS_URL, { transports: ['websocket'] });

    socket.on('order:paid', (data: { orderId: string }) => {
      if (data.orderId === orderId) {
        setOrderStatus('Paid');
        refresh();
      }
    });

    socket.on('order:status', (data: { orderId: string; status: string }) => {
      if (data.orderId === orderId) {
        setOrderStatus(data.status);
        refresh();
      }
    });

    return () => { socket.disconnect(); };
  }, [orderId, refresh, setOrderStatus]);

  const status = order?.status ?? orderStatus ?? 'Open';
  const step = stepIndex(status);
  const isPaid = status === 'Paid';

  function handlePayNow() {
    setScreen('payment');
  }

  function handleAddMore() {
    setScreen('menu');
  }

  if (loading) return (
    <div style={styles.page}>
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p style={{ color: '#5C5650', marginTop: 16 }}>Loading order…</p>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.brand}>PlatePe</span>
        <span style={styles.orderNum}>{order?.orderNumber ?? orderNumber}</span>
      </header>

      <div style={styles.content}>
        {/* Status card */}
        <div style={styles.statusCard}>
          {isPaid ? (
            <>
              <div style={styles.paidIcon}>✓</div>
              <h2 style={{ ...styles.statusHeading, color: '#276749' }}>Payment Confirmed!</h2>
              <p style={styles.statusSub}>Thank you for dining with us. Enjoy your meal!</p>
            </>
          ) : (
            <>
              <div style={styles.pulseRing}>
                <span style={styles.statusEmoji}>
                  {status === 'Open' ? '🍽' : status === 'Sent' ? '👨‍🍳' : '🔔'}
                </span>
              </div>
              <h2 style={styles.statusHeading}>
                {status === 'Open' ? 'Order Received' : status === 'Sent' ? 'Being Prepared' : 'Ready to Serve!'}
              </h2>
              <p style={styles.statusSub}>
                {status === 'Open' && 'Your order has been placed successfully.'}
                {status === 'Sent' && 'The kitchen is working on your order.'}
                {status === 'Ready' && 'Your food is on its way to your table!'}
              </p>
            </>
          )}

          {/* Progress bar */}
          <div style={styles.progressContainer}>
            {STATUS_STEPS.slice(0, -1).map((s, i) => (
              <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  {i > 0 && <div style={{ flex: 1, height: 2, background: i <= step ? '#C4622D' : '#DDD8D0' }} />}
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: i <= step ? '#C4622D' : '#F3EFE8',
                    border: `2px solid ${i <= step ? '#C4622D' : '#DDD8D0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: i <= step ? '#fff' : '#A09890',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  {i < STATUS_STEPS.length - 2 && <div style={{ flex: 1, height: 2, background: i < step ? '#C4622D' : '#DDD8D0' }} />}
                </div>
                <span style={{ fontSize: 10, color: i <= step ? '#C4622D' : '#A09890', fontWeight: i <= step ? 600 : 400 }}>{s}</span>
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
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1814' }}>
                    {item.quantity}× {item.productName}
                  </div>
                  {item.modifiers.length > 0 && (
                    <div style={{ fontSize: 12, color: '#5C5650', marginTop: 2 }}>
                      {item.modifiers.map((m) => m.name).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 100,
                    background: item.status === 'Ready' ? 'rgba(39,103,73,0.10)' : item.status === 'Sent' ? 'rgba(146,88,10,0.08)' : 'rgba(59,95,190,0.08)',
                    color: item.status === 'Ready' ? '#276749' : item.status === 'Sent' ? '#92580A' : '#3B5FBE',
                  }}>
                    {item.status}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>₹{(item.unitPrice * item.quantity).toFixed(0)}</span>
                </div>
              </div>
            ))}

            <div style={styles.billSummary}>
              <div style={styles.billRow}><span>Subtotal</span><span>₹{Number(order.subtotal).toFixed(2)}</span></div>
              <div style={styles.billRow}><span>GST (5%)</span><span>₹{Number(order.tax).toFixed(2)}</span></div>
              <div style={{ ...styles.billRow, fontWeight: 700, fontSize: 16, borderTop: '1px solid #EAE4DB', paddingTop: 10, marginTop: 4 }}>
                <span>Total</span><span>₹{Number(order.total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isPaid && (
          <div style={styles.actions}>
            {(status === 'Ready' || status === 'Open' || status === 'Sent') && (
              <button style={styles.payBtn} onClick={handlePayNow}>
                Pay Bill ₹{Number(order?.total ?? orderTotal ?? 0).toFixed(0)}
              </button>
            )}
            {(status === 'Open') && (
              <button style={styles.addMoreBtn} onClick={handleAddMore}>
                + Add More Items
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: '#F8F6F2',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
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
    borderTopColor: '#C4622D',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    background: '#fff',
    padding: '14px 20px',
    borderBottom: '1px solid #EAE4DB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 22,
    fontWeight: 600,
    color: '#C4622D',
  },
  orderNum: {
    fontSize: 13,
    fontWeight: 600,
    color: '#5C5650',
    background: '#F3EFE8',
    padding: '4px 10px',
    borderRadius: 100,
  },
  content: {
    flex: 1,
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  statusCard: {
    background: '#fff',
    borderRadius: 20,
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
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 22,
    fontWeight: 600,
    color: '#1C1814',
    margin: '0 0 6px',
    letterSpacing: '-0.01em',
  },
  statusSub: { fontSize: 13, color: '#5C5650', margin: '0 0 24px' },
  progressContainer: {
    display: 'flex',
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  itemsCard: {
    background: '#fff',
    borderRadius: 20,
    padding: '20px',
    boxShadow: '0 1px 4px rgba(28,24,20,0.06)',
  },
  itemsTitle: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 17,
    fontWeight: 600,
    color: '#1C1814',
    margin: '0 0 14px',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #F3EFE8',
    gap: 12,
  },
  billSummary: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  billRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#5C5650' },
  actions: { display: 'flex', flexDirection: 'column', gap: 10 },
  payBtn: {
    background: '#C4622D',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    padding: '16px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 4px 16px rgba(196,98,45,0.30)',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  addMoreBtn: {
    background: '#fff',
    color: '#C4622D',
    border: '1.5px solid #C4622D',
    borderRadius: 14,
    padding: '13px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
};
