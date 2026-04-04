import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, CreditCard, Banknote, Smartphone, ChevronLeft, Users } from 'lucide-react';
import { useApp } from '../store/app-store-context';
import { paymentsApi } from '../api/payments';
import { ordersApi } from '../api/orders';
import type { PaymentMethod } from '../types';
import { buildUpiIntentUrl, generateUpiQrDataUrl, getUpiConfig } from '../utils/upi';

const TAX_RATE = 0.05;

const TIP_OPTIONS = [
  { label: 'None', pct: 0 },
  { label: '10%',  pct: 0.10 },
  { label: '15%',  pct: 0.15 },
  { label: '18%',  pct: 0.18 },
];

export default function PaymentScreen() {
  const { activeOrder, tables, navigate, setActiveOrder, refreshTables, showToast } = useApp();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [tipPct, setTipPct] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [upiRef, setUpiRef] = useState('');
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string | null>(null);
  const [upiQrError, setUpiQrError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [splitOn, setSplitOn] = useState(false);
  const [partySize, setPartySize] = useState(2);
  const [perPerson, setPerPerson] = useState<number | null>(null);

  const order = activeOrder;
  const table = tables.find((t) => t.id === order?.tableId);
  const activeItems = useMemo(() => order?.items?.filter((i) => i.status !== 'Voided') ?? [], [order]);

  const subtotal = activeItems.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const discount = Number(order?.discount ?? 0);
  const tipAmount = useMemo(() => {
    if (tipPct === -1) return parseFloat(customTip) || 0;
    return subtotal * tipPct;
  }, [subtotal, tipPct, customTip]);
  const total = subtotal + tax - discount + tipAmount;
  const upiConfig = useMemo(() => getUpiConfig(), []);
  const upiIntentUrl = useMemo(() => {
    if (!order) return null;
    return buildUpiIntentUrl({
      amount: total,
      orderNumber: order.orderNumber,
      tableNumber: table?.number ?? null,
    }, upiConfig);
  }, [order, table?.number, total, upiConfig]);
  const upiConfigMissing = !upiConfig.vpa || !upiConfig.payeeName;
  const change = method === 'CASH' ? (parseFloat(cashTendered) || 0) - total : 0;
  const confirmButtonLabel = method === 'UPI'
    ? `Mark UPI Received · ₹${total.toFixed(2)}`
    : method === 'DIGITAL'
      ? `Confirm Card Payment · ₹${total.toFixed(2)}`
      : `Confirm Cash Payment · ₹${total.toFixed(2)}`;

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

  const handlePay = async () => {
    if (!order) return;
    if (method === 'CASH' && (parseFloat(cashTendered) || 0) < total) {
      showToast('Cash tendered is less than total');
      return;
    }
    setLoading(true);
    try {
      if (tipAmount > 0) await ordersApi.setTip(order.id, tipAmount);
      const payRes = await paymentsApi.create({ orderId: order.id, method, amount: total });
      await paymentsApi.confirm(payRes.data.id, method === 'UPI' ? (upiRef.trim() || undefined) : undefined);
      setSuccess(true);
      setActiveOrder(null);
      await refreshTables();
      setTimeout(() => { navigate('FloorPlan'); }, 2000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (!order) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <p>No active order.</p>
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => navigate('FloorPlan')}>← Floor Plan</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={36} color="var(--green)" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 300, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Payment confirmed
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Returning to floor plan…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 940, display: 'flex', gap: 28, height: '100%' }}>
      {/* Left: summary + tip */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate('Order')}>
            <ChevronLeft size={13} /> Back
          </button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 300, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            Checkout
          </h1>
        </div>

        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>
            {table ? `Table ${table.number}` : 'Takeaway'} · #{order.orderNumber}
          </div>
          {activeItems.map((item) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{item.quantity}× {item.productName}</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>₹{(Number(item.unitPrice) * item.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>Gratuity</div>
          <div style={{ display: 'flex', gap: 7, marginBottom: tipPct === -1 ? 10 : 0 }}>
            {TIP_OPTIONS.map((opt) => (
              <button key={opt.label}
                className={`btn ${tipPct === opt.pct && tipPct !== -1 ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, fontSize: 12 }} onClick={() => { setTipPct(opt.pct); setCustomTip(''); }}>
                {opt.label}
              </button>
            ))}
            <button className={`btn ${tipPct === -1 ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontSize: 12 }} onClick={() => setTipPct(-1)}>Other</button>
          </div>
          {tipPct === -1 && (
            <input className="input" type="number" placeholder="Enter tip amount…" value={customTip} onChange={(e) => setCustomTip(e.target.value)} />
          )}
        </div>
      </div>

      {/* Right: method + confirm */}
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>Payment Method</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              { m: 'CASH'    as PaymentMethod, label: 'Cash',   icon: <Banknote size={16} /> },
              { m: 'DIGITAL' as PaymentMethod, label: 'Card',   icon: <CreditCard size={16} /> },
              { m: 'UPI'     as PaymentMethod, label: 'UPI',    icon: <Smartphone size={16} /> },
            ]).map(({ m, label, icon }) => (
              <button key={m} onClick={() => setMethod(m)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px', borderRadius: 8,
                border: `1px solid ${method === m ? 'var(--accent)' : 'var(--border)'}`,
                background: method === m ? 'var(--accent-bg)' : 'var(--surface)',
                color: method === m ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer', fontSize: 14, fontWeight: method === m ? 600 : 400,
                transition: 'all 140ms', fontFamily: 'var(--font-ui)',
              }}>
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {method === 'CASH' && (
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Cash Tendered</div>
            <input className="input" type="number" placeholder={`₹${total.toFixed(0)}`}
              value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} />
            {(parseFloat(cashTendered) || 0) >= total && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-2)' }}>Change</span>
                <span style={{ color: 'var(--green)', fontWeight: 700 }}>₹{change.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {method === 'UPI' && (
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
              UPI Intent
            </div>

            {upiIntentUrl ? (
              <>
                <div style={{ textAlign: 'center' }}>
                  {upiQrDataUrl ? (
                    <img
                      src={upiQrDataUrl}
                      alt={`UPI QR for ₹${total.toFixed(2)}`}
                      style={{
                        width: 176,
                        height: 176,
                        objectFit: 'contain',
                        margin: '0 auto 12px',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        background: '#fff',
                        padding: 10,
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 176,
                      height: 176,
                      background: 'var(--surface-2)',
                      margin: '0 auto 12px',
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border)',
                      color: 'var(--text-3)',
                      fontSize: 12,
                    }}>
                      Generating QR…
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                    Scan with GPay, PhonePe, or Paytm to pay ₹{total.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
                    VPA: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{upiConfig.vpa}</span>
                  </div>

                  <a
                    className="btn btn-ghost"
                    href={upiIntentUrl}
                    style={{ width: '100%', textDecoration: 'none', marginBottom: 10 }}
                  >
                    <Smartphone size={13} /> Open in UPI app
                  </a>
                </div>
              </>
            ) : (
              <div style={{
                background: 'var(--amber-bg)',
                border: '1px solid rgba(146,88,10,0.18)',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 12,
                color: 'var(--amber)',
                marginBottom: 12,
              }}>
                Configure <code>VITE_UPI_VPA</code> and <code>VITE_UPI_PAYEE_NAME</code> to enable a real UPI QR and deep link.
              </div>
            )}

            {upiQrError && (
              <div style={{
                background: 'var(--red-bg)',
                border: '1px solid rgba(184,50,50,0.18)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12,
                color: 'var(--red)',
                marginBottom: 12,
              }}>
                {upiQrError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                UPI Ref / UTR (Optional)
              </label>
              <input
                className="input"
                type="text"
                placeholder="Enter UPI reference after payment"
                value={upiRef}
                onChange={(e) => setUpiRef(e.target.value)}
              />
            </div>

            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '10px 0 0' }}>
              The QR is amount-linked and updates automatically with the payable total. After the customer pays, confirm it below.
            </p>

            {upiConfigMissing && (
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '8px 0 0' }}>
                Until those env vars are configured, you can still record UPI payments manually.
              </p>
            )}
          </div>
        )}

        {/* Split Bill */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: splitOn ? 12 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-2)' }}>
              <Users size={14} /> Split Bill
            </div>
            <button className={`btn ${splitOn ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => { setSplitOn(!splitOn); setPerPerson(null); }}>
              {splitOn ? 'On' : 'Off'}
            </button>
          </div>
          {splitOn && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <button onClick={() => setPartySize((p) => Math.max(2, p - 1))} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 16, color: 'var(--text)' }}>−</button>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', minWidth: 32, textAlign: 'center' }}>{partySize} guests</span>
                <button onClick={() => setPartySize((p) => Math.min(12, p + 1))} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 16, color: 'var(--text)' }}>+</button>
                <button className="btn btn-ghost" style={{ fontSize: 11, marginLeft: 'auto' }}
                  onClick={async () => {
                    if (!order) return;
                    try {
                      const r = await paymentsApi.split(order.id, { mode: 'EVEN', partySize });
                      setPerPerson(r.data.perPerson);
                    } catch { /* silent */ }
                  }}>
                  Calculate
                </button>
              </div>
              {perPerson !== null && (
                <div style={{ fontSize: 13, color: 'var(--text)', background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                  Per person: <strong style={{ color: 'var(--accent)' }}>₹{perPerson.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          {[
            { label: 'Subtotal', val: `₹${subtotal.toFixed(2)}`, color: 'var(--text-2)' },
            { label: 'GST (5%)', val: `₹${tax.toFixed(2)}`,      color: 'var(--text-2)' },
            ...(discount > 0 ? [{ label: 'Discount', val: `−₹${discount.toFixed(2)}`, color: 'var(--green)' }] : []),
            ...(tipAmount > 0 ? [{ label: 'Tip',      val: `₹${tipAmount.toFixed(2)}`, color: 'var(--text-2)' }] : []),
          ].map((row) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: row.color, marginBottom: 6 }}>
              <span>{row.label}</span><span>{row.val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Total</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, color: 'var(--text)' }}>₹{total.toFixed(2)}</span>
          </div>
        </div>

        <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
          onClick={handlePay} disabled={loading}>
          {loading ? 'Processing…' : confirmButtonLabel}
        </button>
      </div>
    </div>
  );
}
