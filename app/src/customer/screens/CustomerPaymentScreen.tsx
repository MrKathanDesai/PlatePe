import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle,
  ChevronLeft,
  CreditCard,
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
    label: 'Credit Card',
    description: 'Use the card terminal, then confirm here.',
    icon: CreditCard,
  },
  {
    method: 'CASH',
    label: 'Cash',
    description: 'Pay in cash and record it once collected.',
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
    tableNumber,
  } = useCustomer();
  const [method, setMethod] = useState<CustomerPaymentMethod>('UPI');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [upiRef, setUpiRef] = useState('');
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string | null>(null);
  const [upiQrError, setUpiQrError] = useState('');

  const upiConfig = useMemo(() => getUpiConfig(), []);
  const upiIntentUrl = useMemo(() => {
    if (!orderNumber) return null;
    return buildUpiIntentUrl(
      {
        amount: Number(orderTotal ?? 0),
        orderNumber,
        tableNumber,
      },
      upiConfig,
    );
  }, [orderNumber, orderTotal, tableNumber, upiConfig]);
  const upiConfigMissing = !upiConfig.vpa || !upiConfig.payeeName;
  const confirmButtonLabel = method === 'UPI'
    ? `Mark UPI Paid · ₹${Number(orderTotal ?? 0).toFixed(2)}`
    : method === 'DIGITAL'
      ? `Confirm Card Payment · ₹${Number(orderTotal ?? 0).toFixed(2)}`
      : `Confirm Cash Payment · ₹${Number(orderTotal ?? 0).toFixed(2)}`;

  useEffect(() => {
    let cancelled = false;

    if (method !== 'UPI' || !upiIntentUrl) {
      setUpiQrDataUrl(null);
      setUpiQrError('');
      return () => {
        cancelled = true;
      };
    }

    setUpiQrError('');
    generateUpiQrDataUrl(upiIntentUrl)
      .then((dataUrl) => {
        if (!cancelled) setUpiQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setUpiQrDataUrl(null);
          setUpiQrError('Could not generate the UPI QR right now.');
        }
      });

    return () => {
      cancelled = true;
    };
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
      setSuccess(true);
      setTimeout(() => setScreen('status'), 1500);
    } catch (e: any) {
      setError(e.message ?? 'Payment failed');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.successBox}>
          <div style={styles.successBadge}>
            <CheckCircle size={38} color="#276749" />
          </div>
          <h2 style={styles.successTitle}>Payment recorded</h2>
          <p style={styles.successSub}>Your order has been marked as paid.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button style={styles.backBtn} onClick={() => setScreen('status')}>
          <ChevronLeft size={16} /> Back
        </button>
        <span style={styles.brand}>PlatePe</span>
        <span style={styles.headerSpacer} />
      </header>

      <div style={styles.content}>
        <div style={styles.card}>
          <h2 style={styles.heading}>Settle Bill</h2>

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

          <div style={styles.methods}>
            {METHOD_OPTIONS.map(({ method: value, label, description, icon: Icon }) => {
              const selected = method === value;
              return (
                <button
                  key={value}
                  type="button"
                  style={{
                    ...styles.methodButton,
                    borderColor: selected ? '#C4622D' : '#EAE4DB',
                    background: selected ? '#FFF5EE' : '#fff',
                  }}
                  onClick={() => setMethod(value)}
                >
                  <div style={{
                    ...styles.methodIconWrap,
                    background: selected ? '#C4622D' : '#F3EFE8',
                    color: selected ? '#fff' : '#5C5650',
                  }}
                  >
                    <Icon size={18} />
                  </div>
                  <div style={styles.methodCopy}>
                    <span style={styles.methodLabel}>{label}</span>
                    <span style={styles.methodDescription}>{description}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {method === 'UPI' && (
            <div style={styles.methodPanel}>
              <div style={styles.upiPillRow}>
                {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map((app) => (
                  <span key={app} style={styles.upiPill}>{app}</span>
                ))}
              </div>

              {upiIntentUrl ? (
                <div style={styles.upiBox}>
                  {upiQrDataUrl ? (
                    <img
                      src={upiQrDataUrl}
                      alt={`UPI QR for ₹${Number(orderTotal ?? 0).toFixed(2)}`}
                      style={styles.upiQr}
                    />
                  ) : (
                    <div style={styles.upiQrPlaceholder}>Generating QR…</div>
                  )}

                  <p style={styles.upiHint}>
                    Scan the QR or open a UPI app to pay ₹{Number(orderTotal ?? 0).toFixed(2)}.
                  </p>
                  <p style={styles.upiMeta}>
                    VPA: <strong>{upiConfig.vpa}</strong>
                  </p>

                  <a href={upiIntentUrl} style={styles.upiLink}>
                    <Smartphone size={14} /> Open in UPI App
                  </a>
                </div>
              ) : (
                <div style={styles.warningBox}>
                  Configure `VITE_UPI_VPA` and `VITE_UPI_PAYEE_NAME` to enable a real UPI QR and deep link.
                </div>
              )}

              {upiQrError && (
                <div style={styles.errorBox}>{upiQrError}</div>
              )}

              <div>
                <label style={styles.inputLabel}>UPI Ref / UTR (Optional)</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Enter UPI reference after payment"
                  value={upiRef}
                  onChange={(event) => setUpiRef(event.target.value)}
                />
              </div>

              {upiConfigMissing && (
                <p style={styles.methodNote}>
                  Until the UPI env vars are configured, you can still record the payment manually.
                </p>
              )}
            </div>
          )}

          {method === 'DIGITAL' && (
            <div style={styles.methodPanel}>
              <p style={styles.methodNote}>
                Run the card on your terminal first, then tap confirm here to mark the order paid.
              </p>
            </div>
          )}

          {method === 'CASH' && (
            <div style={styles.methodPanel}>
              <p style={styles.methodNote}>
                Collect the cash at the table or counter, then confirm below to close the bill.
              </p>
            </div>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <button
            style={{ ...styles.payBtn, opacity: loading ? 0.65 : 1 }}
            onClick={handlePay}
            disabled={loading}
          >
            {loading ? 'Confirming Payment…' : confirmButtonLabel}
          </button>

          <p style={styles.secureNote}>
            This is the separate bill step. Your order was already sent to the kitchen earlier.
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
    gap: 12,
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
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
  headerSpacer: { width: 44 },
  content: {
    flex: 1,
    padding: '24px 16px',
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
  tableLabel: {
    fontSize: 14,
    color: '#5C5650',
  },
  tableVal: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1C1814',
  },
  divider: {
    height: 1,
    background: '#EAE4DB',
    margin: '4px 0 16px',
  },
  totalRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    color: '#5C5650',
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1C1814',
  },
  methods: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  methodButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    border: '1px solid #EAE4DB',
    borderRadius: 16,
    padding: '14px 16px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  methodIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  methodCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  methodLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1C1814',
  },
  methodDescription: {
    fontSize: 12,
    color: '#5C5650',
    lineHeight: 1.45,
  },
  methodPanel: {
    marginTop: 16,
    borderRadius: 16,
    background: '#FCFAF7',
    border: '1px solid #F0E8DE',
    padding: '16px 16px 14px',
  },
  methodNote: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: '#5C5650',
  },
  upiPillRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  upiPill: {
    borderRadius: 999,
    padding: '6px 10px',
    background: '#F3EFE8',
    color: '#5C5650',
    fontSize: 11,
    fontWeight: 600,
  },
  upiBox: {
    textAlign: 'center',
  },
  upiQr: {
    width: 176,
    height: 176,
    objectFit: 'contain',
    margin: '0 auto 12px',
    borderRadius: 12,
    border: '1px solid #EAE4DB',
    background: '#fff',
    padding: 10,
    display: 'block',
  },
  upiQrPlaceholder: {
    width: 176,
    height: 176,
    margin: '0 auto 12px',
    borderRadius: 12,
    border: '1px solid #EAE4DB',
    background: '#F7F1E9',
    color: '#8B8278',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
  },
  upiHint: {
    fontSize: 12,
    color: '#5C5650',
    margin: '0 0 8px',
    lineHeight: 1.5,
  },
  upiMeta: {
    fontSize: 11,
    color: '#5C5650',
    margin: '0 0 12px',
  },
  upiLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    background: '#FFF3E8',
    color: '#C4622D',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
    boxSizing: 'border-box',
    marginBottom: 14,
  },
  inputLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: '#5C5650',
    marginBottom: 6,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  warningBox: {
    background: 'rgba(146,88,10,0.08)',
    border: '1px solid rgba(146,88,10,0.18)',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 12,
    color: '#92580A',
    lineHeight: 1.5,
    marginBottom: 14,
  },
  errorBox: {
    background: 'rgba(184,50,50,0.07)',
    border: '1px solid rgba(184,50,50,0.18)',
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: 12,
    color: '#B83232',
    marginBottom: 12,
  },
  error: {
    color: '#B83232',
    fontSize: 13,
    margin: '14px 0 0',
    textAlign: 'center',
  },
  payBtn: {
    width: '100%',
    marginTop: 18,
    border: 'none',
    borderRadius: 14,
    padding: '16px 18px',
    background: '#C4622D',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  secureNote: {
    fontSize: 12,
    color: '#7A7168',
    textAlign: 'center',
    margin: '12px 0 0',
    lineHeight: 1.5,
  },
  successBox: {
    margin: 'auto 16px',
    background: '#fff',
    borderRadius: 24,
    padding: '36px 28px',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(28,24,20,0.08)',
  },
  successBadge: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'rgba(39,103,73,0.10)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  successTitle: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 28,
    fontWeight: 600,
    color: '#1C1814',
    margin: '0 0 8px',
  },
  successSub: {
    margin: 0,
    fontSize: 14,
    color: '#5C5650',
    lineHeight: 1.6,
  },
};
