import { useState, useEffect, useRef } from 'react';
import { customerApi } from '../api/customerApi';
import type { MenuCategory, MenuItem } from '../api/customerApi';
import { useCustomer } from '../CustomerContext';

export default function MenuScreen() {
  const { cart, addToCart, updateQty, cartTotal, cartCount, setScreen, setOrder, tableId, sessionActive } = useCustomer();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>('');
  const [modItem, setModItem] = useState<MenuItem | null>(null);
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [placingOrder, setPlacingOrder] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [note, setNote] = useState('');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    customerApi.getMenu().then((cats) => {
      setCategories(cats);
      if (cats.length) setActiveCat(cats[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function scrollToCategory(catId: string) {
    sectionRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveCat(catId);
  }

  function handleAddItem(item: MenuItem) {
    if (item.modifiers.length > 0) {
      setModItem(item);
      setSelectedMods(new Set());
      setNote('');
    } else {
      addToCart({ productId: item.id, productName: item.name, unitPrice: item.price, quantity: 1, modifiers: [] });
    }
  }

  function confirmMods() {
    if (!modItem) return;
    const mods = modItem.modifiers.filter((m) => selectedMods.has(m.id));
    addToCart({ productId: modItem.id, productName: modItem.name, unitPrice: modItem.price, quantity: 1, modifiers: mods, note: note || undefined });
    setModItem(null);
  }

  async function placeOrder() {
    if (!tableId) return;
    setPlacingOrder(true);
    try {
      const order = await customerApi.createOrder(tableId);
      const updated = await customerApi.addItems(order.id, cart.map((c) => ({
        productId: c.productId,
        productName: c.productName,
        unitPrice: c.unitPrice,
        quantity: c.quantity,
        modifiers: c.modifiers,
        note: c.note,
      })));
      setOrder(updated.id, updated.orderNumber, updated.status, updated.total);
      setScreen('status');
    } catch (e: any) {
      alert(e.message ?? 'Failed to place order');
    } finally {
      setPlacingOrder(false);
    }
  }

  function getCartQty(productId: string, modIds: string[]) {
    const key = `${productId}::${modIds.sort().join(',')}`;
    return cart.find((c) => c.key === key)?.quantity ?? 0;
  }

  if (loading) return (
    <div style={styles.loadingPage}>
      <div style={styles.spinner} />
      <p style={{ color: '#5C5650', marginTop: 16 }}>Loading menu…</p>
    </div>
  );

  if (!sessionActive) return (
    <div style={styles.loadingPage}>
      <span style={{ fontSize: 48 }}>🔒</span>
      <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", color: '#1C1814', marginTop: 16 }}>Restaurant is closed</h2>
      <p style={{ color: '#5C5650' }}>No active session right now. Please try again later.</p>
    </div>
  );

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 600, color: '#C4622D' }}>PlatePe</span>
        </div>
      </header>

      {/* Category tabs */}
      <div style={styles.catBar}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            style={{ ...styles.catTab, ...(activeCat === cat.id ? styles.catTabActive : {}) }}
            onClick={() => scrollToCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu sections */}
      <div style={styles.content}>
        {categories.map((cat) => (
          <div key={cat.id} ref={(el) => { sectionRefs.current[cat.id] = el; }} style={styles.section}>
            <h2 style={styles.catHeading}>{cat.name}</h2>
            <div style={styles.grid}>
              {cat.products.map((item) => {
                const qty = getCartQty(item.id, []);
                return (
                  <div key={item.id} style={styles.card}>
                    {item.image && (
                      <img src={item.image} alt={item.name} style={styles.cardImage} />
                    )}
                    <div style={styles.cardBody}>
                      <div style={styles.cardName}>{item.name}</div>
                      {item.description && <p style={styles.cardDesc}>{item.description}</p>}
                      {item.modifiers.length > 0 && (
                        <p style={styles.modTag}>+ {item.modifiers.length} add-on{item.modifiers.length > 1 ? 's' : ''}</p>
                      )}
                      <div style={styles.cardFooter}>
                        <span style={styles.price}>₹{item.price}</span>
                        {qty === 0 ? (
                          <button style={styles.addBtn} onClick={() => handleAddItem(item)}>Add</button>
                        ) : (
                          <div style={styles.qtyRow}>
                            <button style={styles.qtyBtn} onClick={() => {
                              const key = `${item.id}::`;
                              const cartItem = cart.find((c) => c.key === key);
                              if (cartItem) updateQty(cartItem.key, -1);
                            }}>−</button>
                            <span style={styles.qtyNum}>{qty}</span>
                            <button style={styles.qtyBtn} onClick={() => handleAddItem(item)}>+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ height: 100 }} />
      </div>

      {/* Cart FAB */}
      {cartCount > 0 && (
        <div style={styles.cartBar} onClick={() => setShowCart(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={styles.cartBadge}>{cartCount}</span>
            <span style={{ fontWeight: 600, fontSize: 15 }}>View Cart</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>₹{(cartTotal * 1.05).toFixed(0)}</span>
        </div>
      )}

      {/* Modifier modal */}
      {modItem && (
        <div style={styles.overlay} onClick={() => setModItem(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{modItem.name}</h3>
            <p style={{ color: '#5C5650', fontSize: 13, margin: '0 0 16px' }}>Choose add-ons (optional)</p>
            {modItem.modifiers.map((m) => (
              <label key={m.id} style={styles.modRow}>
                <input
                  type="checkbox"
                  checked={selectedMods.has(m.id)}
                  onChange={() => setSelectedMods((prev) => {
                    const next = new Set(prev);
                    next.has(m.id) ? next.delete(m.id) : next.add(m.id);
                    return next;
                  })}
                  style={{ accentColor: '#C4622D', width: 18, height: 18 }}
                />
                <span style={{ flex: 1, marginLeft: 10, fontSize: 14 }}>{m.name}</span>
                <span style={{ color: '#C4622D', fontWeight: 600, fontSize: 14 }}>+₹{m.price}</span>
              </label>
            ))}
            <div style={{ marginTop: 16 }}>
              <label style={styles.label}>Special instructions</label>
              <input
                style={styles.noteInput}
                placeholder="e.g. extra spicy, no onions…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <button style={styles.confirmBtn} onClick={confirmMods}>
              Add to Cart — ₹{(modItem.price + [...selectedMods].reduce((s, id) => {
                const m = modItem.modifiers.find((m) => m.id === id);
                return s + (m?.price ?? 0);
              }, 0)).toFixed(0)}
            </button>
          </div>
        </div>
      )}

      {/* Cart sheet */}
      {showCart && (
        <div style={styles.overlay} onClick={() => setShowCart(false)}>
          <div style={styles.cartSheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.sheetHandle} />
            <h3 style={styles.sheetTitle}>Your Order</h3>

            <div style={styles.cartItems}>
              {cart.map((item) => (
                <div key={item.key} style={styles.cartItemRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1814' }}>{item.productName}</div>
                    {item.modifiers.length > 0 && (
                      <div style={{ fontSize: 12, color: '#5C5650', marginTop: 2 }}>
                        {item.modifiers.map((m) => m.name).join(', ')}
                      </div>
                    )}
                  </div>
                  <div style={styles.qtyRow}>
                    <button style={styles.qtyBtn} onClick={() => updateQty(item.key, -1)}>−</button>
                    <span style={styles.qtyNum}>{item.quantity}</span>
                    <button style={styles.qtyBtn} onClick={() => updateQty(item.key, 1)}>+</button>
                  </div>
                  <span style={{ minWidth: 60, textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                    ₹{((item.unitPrice + item.modifiers.reduce((s, m) => s + m.price, 0)) * item.quantity).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>

            <div style={styles.billSummary}>
              <div style={styles.billRow}>
                <span>Subtotal</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
              <div style={styles.billRow}>
                <span>GST (5%)</span>
                <span>₹{(cartTotal * 0.05).toFixed(2)}</span>
              </div>
              <div style={{ ...styles.billRow, fontWeight: 700, fontSize: 16, borderTop: '1px solid #DDD8D0', paddingTop: 10, marginTop: 4 }}>
                <span>Total</span>
                <span>₹{(cartTotal * 1.05).toFixed(2)}</span>
              </div>
            </div>

            <p style={styles.billNote}>
              Place the order now and settle the bill later from the bill section.
            </p>

            <button
              style={{ ...styles.confirmBtn, opacity: placingOrder ? 0.6 : 1 }}
              onClick={placeOrder}
              disabled={placingOrder}
            >
              {placingOrder ? 'Placing Order…' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100dvh',
    background: '#F8F6F2',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    maxWidth: 480,
    margin: '0 auto',
    position: 'relative',
  },
  loadingPage: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
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
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },
  catBar: {
    display: 'flex',
    gap: 8,
    padding: '10px 16px',
    overflowX: 'auto',
    background: '#fff',
    borderBottom: '1px solid #EAE4DB',
    position: 'sticky',
    top: 51,
    zIndex: 19,
    scrollbarWidth: 'none',
  },
  catTab: {
    flexShrink: 0,
    padding: '6px 14px',
    borderRadius: 100,
    border: '1.5px solid #DDD8D0',
    background: '#fff',
    color: '#5C5650',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    transition: 'all 0.15s',
  },
  catTabActive: {
    background: '#C4622D',
    border: '1.5px solid #C4622D',
    color: '#fff',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  section: { marginBottom: 32 },
  catHeading: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 20,
    fontWeight: 600,
    color: '#1C1814',
    margin: '0 0 14px',
    letterSpacing: '-0.01em',
  },
  grid: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(28,24,20,0.06)',
    display: 'flex',
    gap: 0,
    flexDirection: 'row',
  },
  cardImage: {
    width: 96,
    height: 96,
    objectFit: 'cover',
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardName: { fontWeight: 600, fontSize: 14, color: '#1C1814', lineHeight: 1.3 },
  cardDesc: { fontSize: 12, color: '#A09890', margin: '4px 0 0', lineHeight: 1.4 },
  modTag: { fontSize: 11, color: '#C4622D', fontWeight: 600, margin: '4px 0 0' },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  price: { fontWeight: 700, color: '#1C1814', fontSize: 15 },
  addBtn: {
    background: '#C4622D',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '6px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  qtyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(196,98,45,0.08)',
    borderRadius: 8,
    padding: '3px 4px',
  },
  qtyBtn: {
    background: '#C4622D',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    width: 26,
    height: 26,
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    lineHeight: 1,
  },
  qtyNum: { minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#C4622D' },
  cartBar: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 32px)',
    maxWidth: 448,
    background: '#C4622D',
    color: '#fff',
    borderRadius: 16,
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(196,98,45,0.35)',
    zIndex: 30,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  cartBadge: {
    background: '#fff',
    color: '#C4622D',
    borderRadius: 100,
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 50,
  },
  modal: {
    background: '#fff',
    borderRadius: '20px 20px 0 0',
    padding: '24px 20px',
    width: '100%',
    maxWidth: 480,
    maxHeight: '80dvh',
    overflowY: 'auto',
  },
  modalTitle: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 20,
    fontWeight: 600,
    color: '#1C1814',
    margin: '0 0 4px',
  },
  modRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #F3EFE8',
    cursor: 'pointer',
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#1C1814',
    marginBottom: 6,
  },
  noteInput: {
    width: '100%',
    border: '1.5px solid #DDD8D0',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    color: '#1C1814',
    background: '#FAFAF8',
    outline: 'none',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  confirmBtn: {
    width: '100%',
    background: '#C4622D',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 16,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  cartSheet: {
    background: '#fff',
    borderRadius: '20px 20px 0 0',
    padding: '16px 20px 32px',
    width: '100%',
    maxWidth: 480,
    maxHeight: '85dvh',
    overflowY: 'auto',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    background: '#DDD8D0',
    borderRadius: 2,
    margin: '0 auto 16px',
  },
  sheetTitle: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 20,
    fontWeight: 600,
    color: '#1C1814',
    margin: '0 0 16px',
  },
  cartItems: { display: 'flex', flexDirection: 'column', gap: 12 },
  cartItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid #F3EFE8',
  },
  billSummary: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  billRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    color: '#5C5650',
  },
  billNote: {
    margin: '14px 0 0',
    fontSize: 12,
    lineHeight: 1.5,
    color: '#5C5650',
  },
};
