import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle,
  ChevronLeft,
  CreditCard,
  LogOut,
  Smartphone,
} from 'lucide-react';
import { customerApi, type CustomerPaymentMethod } from '../api/customerApi';
import { useCustomer } from '../CustomerContext';
import {
  buildUpiIntentUrl,
  generateUpiQrDataUrl,
  getUpiConfig,
} from '../../utils/upi';

const METHOD_OPTIONS: Array<{
  method: CustomerPaymentMethod;
  label: string;
  description: string;
  icon: typeof Banknote;
}> = [
  {
    method: 'UPI',
    label: 'UPI',
    description: 'Scan the QR or open your preferred UPI app.',
    icon: Smartphone,
  },
  {
    method: 'DIGITAL',
    label: 'Card',
    description: 'Request the card terminal at your table.',
    icon: CreditCard,
  },
  {
    method: 'CASH',
    label: 'Cash',
    description: 'Ask staff to collect cash from your table.',
    icon: Banknote,
  },
];

export default function CustomerPaymentScreen() {
  const {
    orderId,
    orderNumber,
    orderTotal,
    setScreen,
    setOrderStatus,
    clearCart,
    logout,
    tableNumber,
  } = useCustomer();
  const [method, setMethod] = useState<CustomerPaymentMethod>('UPI');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successState, setSuccessState] = useState<'paid' | 'requested' | null>(null);
  const [upiRef, setUpiRef] = useState('');
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string | null>(null);
  const [upiQrError, setUpiQrError] = useState('');

  const upiConfig = useMemo(() => getUpiConfig(), []);
  const upiIntentUrl = useMemo(() => {
    if (!orderNumber) return null;
    return buildUpiIntentUrl(
      { amount: Number(orderTotal ?? 0), orderNumber, tableNumber },
      upiConfig,
    );
  }, [orderNumber, orderTotal, tableNumber, upiConfig]);

  const upiConfigMissing = !upiConfig.vpa || !upiConfig.payeeName;

  const confirmButtonLabel = method === 'UPI'
    ? `Mark UPI Paid · ₹${Number(orderTotal ?? 0).toFixed(2)}`
    : method === 'DIGITAL'
      ? `Request Card Payment · ₹${Number(orderTotal ?? 0).toFixed(2)}`
      : `Request Cash Collection · ₹${Number(orderTotal ?? 0).toFixed(2)}`;

  useEffect(() => {
    let cancelled = false;
    if (method !== 'UPI' || !upiIntentUrl) {
      setUpiQrDataUrl(null);
      setUpiQrError('');
      return () => { cancelled = true; };
    }
    setUpiQrError('');
    generateUpiQrDataUrl(upiIntentUrl)
      .then((dataUrl) => { if (!cancelled) setUpiQrDataUrl(dataUrl); })
      .catch(() => {
        if (!cancelled) { setUpiQrDataUrl(null); setUpiQrError('Could not generate the UPI QR right now.'); }
      });
    return () => { cancelled = true; };
  }, [method, upiIntentUrl]);

  async function handlePay() {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      const result = await customerApi.payOrder({
        orderId,
        method,
        upiRef: method === 'UPI' ? (upiRef.trim() || undefined) : undefined,
      });
      clearCart();
      setOrderStatus(result.orderStatus);
      setSuccessState(result.paymentRequestStatus === 'REQUESTED' ? 'requested' : 'paid');
      setTimeout(() => setScreen('status'), 1500);
    } catch (e: any) {
      setError(e.message ?? 'Payment failed');
    } finally {
      setLoading(false);
    }
  }

  if (successState) {
    return (
      <div style={s.page}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius)', background: 'var(--green-bg)', border: '1.5px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <CheckCircle size={32} color="var(--green)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
            {successState === 'paid' ? 'Payment recorded' : 'Staff notified'}
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
            {successState === 'paid'
              ? 'Your order has been marked as paid.'
              : 'A cashier has been notified on the floor plan and will collect your payment shortly.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => setScreen('status')}>
          <ChevronLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.04em' }}>
            plate<span style={{ color: 'var(--accent)' }}>pe</span>
          </span>
          {tableNumber && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, padding: '2px 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Table {tableNumber}
            </span>
          )}
        </div>
        <button style={s.logoutBtn} onClick={logout}>
          <LogOut size={13} /> Out
        </button>
      </header>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' }}>
        <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px 20px', boxShadow: 'var(--shadow-hard)' }}>
          <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 20px', letterSpacing: '-0.04em' }}>
            Settle Bill
          </h2>

          {/* Order info rows */}
          {tableNumber && (
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Table</span>
              <span style={s.infoVal}>{tableNumber}</span>
            </div>
          )}
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Order</span>
            <span style={{ ...s.infoVal, fontFamily: 'var(--font-mono)' }}>{orderNumber}</span>
          </div>

          <hr style={{ border: 'none', borderTop: '1.5px solid var(--border)', margin: '12px 0 16px' }} />

          {/* Total */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 22 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              ₹{Number(orderTotal ?? 0).toFixed(2)}
            </span>
          </div>

          {/* Payment method selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {METHOD_OPTIONS.map(({ method: value, label, description, icon: Icon }) => {
              const selected = method === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    border: selected ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: selected ? 'var(--accent-bg)' : 'var(--bg)',
                    transition: 'all 100ms',
                    boxShadow: selected ? 'var(--shadow-hard-sm)' : 'none',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius)',
                    background: selected ? 'var(--accent)' : 'var(--surface-2)',
                    border: selected ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: selected ? '#fff' : 'var(--text-2)',
                    flexShrink: 0,
                  }}>
                    <Icon size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, color: selected ? 'var(--accent)' : 'var(--text)' }}>{label}</span>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{description}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* UPI panel */}
          {method === 'UPI' && (
            <div style={{ borderRadius: 'var(--radius)', background: 'var(--surface-2)', border: '1.5px solid var(--border)', padding: '16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map((app) => (
                  <span key={app} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, padding: '3px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-2)', letterSpacing: '0.06em' }}>
                    {app}
                  </span>
                ))}
              </div>

              {upiIntentUrl ? (
                <div style={{ textAlign: 'center' }}>
                  {upiQrDataUrl ? (
                    <img src={upiQrDataUrl} alt={`UPI QR ₹${Number(orderTotal ?? 0).toFixed(2)}`}
                      style={{ width: 168, height: 168, objectFit: 'contain', margin: '0 auto 10px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: '#fff', padding: 8, display: 'block' }} />
                  ) : (
                    <div style={{ width: 168, height: 168, margin: '0 auto 10px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      Generating QR…
                    </div>
                  )}
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-3)', margin: '0 0 4px' }}>
                    Scan to pay ₹{Number(orderTotal ?? 0).toFixed(2)}
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', margin: '0 0 12px' }}>
                    {upiConfig.vpa}
                  </p>
                  <a href={upiIntentUrl} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 'var(--radius)', background: 'var(--accent-bg)', border: '1.5px solid var(--accent-mid)', color: 'var(--accent)', textDecoration: 'none', fontSize: 13, fontWeight: 600, boxSizing: 'border-box', width: '100%', marginBottom: 12, fontFamily: 'var(--font-ui)' }}>
                    <Smartphone size={13} /> Open UPI App
                  </a>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--amber)', lineHeight: 1.5, marginBottom: 12 }}>
                  Configure VITE_UPI_VPA and VITE_UPI_PAYEE_NAME to enable UPI QR.
                </div>
              )}

              {upiQrError && (
                <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '8px 10px', fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>
                  {upiQrError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  UPI Ref / UTR (Optional)
                </label>
                <input className="input" type="text" placeholder="Enter UPI reference" value={upiRef} onChange={(e) => setUpiRef(e.target.value)} />
              </div>

              {upiConfigMissing && (
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-3)', margin: '10px 0 0', lineHeight: 1.5 }}>
                  UPI env vars not configured — you can still record the payment manually.
                </p>
              )}
            </div>
          )}

          {method === 'DIGITAL' && (
            <div style={{ borderRadius: 'var(--radius)', background: 'var(--surface-2)', border: '1.5px solid var(--border)', padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' }}>
                Tap below to alert the cashier that you want to pay by card at the table.
              </p>
            </div>
          )}

          {method === 'CASH' && (
            <div style={{ borderRadius: 'var(--radius)', background: 'var(--surface-2)', border: '1.5px solid var(--border)', padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' }}>
                Tap below to alert the cashier that you want to settle this bill in cash.
              </p>
            </div>
          )}

          {error && (
            <p style={{ color: 'var(--red)', fontFamily: 'var(--font-ui)', fontSize: 13, margin: '0 0 14px', textAlign: 'center' }}>{error}</p>
          )}

          <button
            className="btn btn-primary btn-lg"
            onClick={handlePay}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? (method === 'UPI' ? 'Confirming…' : 'Sending request…') : confirmButtonLabel}
          </button>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textAlign: 'center', margin: '12px 0 0', letterSpacing: '0.04em' }}>
            Your order was already sent to the kitchen.
          </p>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'var(--font-ui)',
    maxWidth: 480,
    margin: '0 auto',
  },
  header: {
    background: 'var(--surface)',
    padding: '14px 18px',
    borderBottom: '1.5px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    boxShadow: 'var(--shadow-hard-sm)',
  },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'none', border: 'none',
    color: 'var(--accent)', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', padding: 0,
    fontFamily: 'var(--font-ui)',
  },
  logoutBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: 'var(--surface-2)', border: '1.5px solid var(--border)',
    color: 'var(--text-2)', borderRadius: 'var(--radius)',
    padding: '5px 9px', fontSize: 11, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
  },
  infoRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid var(--border)',
  },
  infoLabel: {
    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)',
    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
  },
  infoVal: {
    fontSize: 14, fontWeight: 600, color: 'var(--text)',
  },
};
