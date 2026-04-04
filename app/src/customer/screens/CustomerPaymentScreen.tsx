import { useState, useEffect } from 'react';
import { customerApi } from '../api/customerApi';
import { useCustomer } from '../CustomerContext';

// Razorpay types
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CustomerPaymentScreen() {
  const { orderId, orderNumber, orderTotal, setScreen, setOrderStatus, clearCart, customer, tableNumber } = useCustomer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scriptReady, setScriptReady] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadRazorpayScript().then(setScriptReady);
  }, []);

  async function handlePay() {
    if (!orderId || !scriptReady) return;
    setLoading(true);
    setError('');
    try {
      const rzp = await customerApi.createRazorpayOrder(orderId);

      const options = {
        key: rzp.keyId,
        amount: rzp.amount,
        currency: rzp.currency,
        name: 'PlatePe',
        description: `Order ${rzp.orderNumber}`,
        order_id: rzp.rzpOrderId,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await customerApi.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              orderId: orderId!,
            });
            clearCart();
            setOrderStatus('Paid');
            setSuccess(true);
            setTimeout(() => setScreen('status'), 1500);
          } catch (e: any) {
            setError(e.message ?? 'Payment verification failed');
          }
        },
        prefill: {
          contact: customer?.phone ? `+91${customer.phone}` : '',
          name: customer?.name ?? '',
        },
        theme: { color: '#C4622D' },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
      setLoading(false);
    } catch (e: any) {
      setError(e.message ?? 'Failed to initiate payment');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.successBox}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Payment Successful!</h2>
          <p style={styles.successSub}>Thank you! Your payment has been confirmed.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button style={styles.backBtn} onClick={() => setScreen('status')}>
          ← Back
        </button>
        <span style={styles.brand}>PlatePe</span>
        <span />
      </header>

      <div style={styles.content}>
        <div style={styles.card}>
          <h2 style={styles.heading}>Pay Your Bill</h2>

          {tableNumber && (
            <div style={styles.tableRow}>
              <span style={styles.tableLabel}>Table</span>
              <span style={styles.tableVal}>{tableNumber}</span>
            </div>
          )}

          <div style={styles.tableRow}>
            <span style={styles.tableLabel}>Order</span>
            <span style={styles.tableVal}>{orderNumber}</span>
          </div>

          <div style={styles.divider} />

          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Total Amount</span>
            <span style={styles.totalAmount}>₹{Number(orderTotal ?? 0).toFixed(2)}</span>
          </div>

          <div style={styles.powered}>
            <span style={{ color: '#A09890', fontSize: 11 }}>Powered by</span>
            <span style={{ fontWeight: 700, color: '#3395FF', fontSize: 13, marginLeft: 4 }}>Razorpay</span>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          {!scriptReady && (
            <p style={{ fontSize: 13, color: '#92580A', textAlign: 'center', margin: '0 0 12px' }}>
              Loading payment gateway…
            </p>
          )}

          <button
            style={{ ...styles.payBtn, opacity: loading || !scriptReady ? 0.65 : 1 }}
            onClick={handlePay}
            disabled={loading || !scriptReady}
          >
            {loading ? 'Opening Checkout…' : `Pay ₹${Number(orderTotal ?? 0).toFixed(2)}`}
          </button>

          <p style={styles.secureNote}>
            🔒 100% secure payment via Razorpay
          </p>
        </div>
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
  header: {
    background: '#fff',
    padding: '14px 20px',
    borderBottom: '1px solid #EAE4DB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#C4622D',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  brand: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 22,
    fontWeight: 600,
    color: '#C4622D',
  },
  content: {
    flex: 1,
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '28px 24px',
    boxShadow: '0 2px 8px rgba(28,24,20,0.07)',
  },
  heading: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 24,
    fontWeight: 600,
    color: '#1C1814',
    margin: '0 0 24px',
    letterSpacing: '-0.02em',
  },
  tableRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #F3EFE8',
  },
  tableLabel: { fontSize: 14, color: '#5C5650' },
  tableVal: { fontSize: 14, fontWeight: 600, color: '#1C1814' },
  divider: { height: 1, background: '#EAE4DB', margin: '4px 0 16px' },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: '8px 0 4px',
  },
  totalLabel: { fontSize: 16, fontWeight: 600, color: '#1C1814' },
  totalAmount: {
    fontSize: 28,
    fontWeight: 700,
    color: '#C4622D',
    fontFamily: "'Fraunces', Georgia, serif",
  },
  powered: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    margin: '4px 0 20px',
  },
  payBtn: {
    width: '100%',
    background: '#C4622D',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    padding: '16px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(196,98,45,0.30)',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    transition: 'transform 0.1s',
  },
  secureNote: {
    textAlign: 'center',
    color: '#A09890',
    fontSize: 12,
    margin: '12px 0 0',
  },
  error: {
    background: 'rgba(184,50,50,0.07)',
    color: '#B83232',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 12,
  },
  successBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    textAlign: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: '#276749',
    color: '#fff',
    fontSize: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    fontWeight: 700,
    boxShadow: '0 8px 24px rgba(39,103,73,0.25)',
  },
  successTitle: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 28,
    fontWeight: 600,
    color: '#1C1814',
    margin: '0 0 8px',
    letterSpacing: '-0.02em',
  },
  successSub: { fontSize: 15, color: '#5C5650', lineHeight: 1.5 },
};
