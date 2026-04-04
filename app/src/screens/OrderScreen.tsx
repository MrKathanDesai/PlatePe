import { useState, useMemo, useEffect } from 'react';
import { Plus, Minus, Trash2, Ban, ChevronRight, Tag, Send, Search, X, Check } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { ordersApi } from '../api/orders';
import { discountsApi } from '../api/discounts';
import type { Order, OrderItem, Product, Discount, Modifier } from '../types';

const TAX_RATE = 0.05;

function ProductCard({ product, count, onAdd }: { product: Product; count: number; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      disabled={product.is86d}
      style={{
        background: 'var(--surface)',
        border: count > 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 10, padding: 12,
        cursor: product.is86d ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        opacity: product.is86d ? 0.45 : 1,
        transition: 'all 130ms', width: '100%', position: 'relative',
        boxShadow: count > 0 ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
      }}
      onMouseEnter={(e) => { if (!product.is86d) (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = count > 0 ? 'var(--shadow-sm)' : 'var(--shadow-xs)'; }}
    >
      {product.is86d && (
        <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, padding: '2px 6px', borderRadius: 100, background: 'var(--red-bg)', color: 'var(--red)', fontWeight: 700 }}>86</span>
      )}
      {count > 0 && (
        <span style={{
          position: 'absolute', top: -7, right: -7, width: 19, height: 19,
          borderRadius: '50%', background: 'var(--accent)', color: '#fff',
          fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}>{count}</span>
      )}
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: 'var(--accent-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 9, color: 'var(--accent)',
        fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 300,
      }}>
        {product.name[0]}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3, lineHeight: 1.3 }}>
        {product.name}
      </div>
      <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
        ₹{Number(product.price).toFixed(0)}
      </div>
    </button>
  );
}

function CartItem({ item, onInc, onDec, onRemove, onVoid }: {
  item: OrderItem; onInc: () => void; onDec: () => void; onRemove: () => void; onVoid: () => void;
}) {
  const lineTotal = Number(item.unitPrice) * item.quantity;
  return (
    <div style={{ padding: '11px 0', borderBottom: '1px solid var(--border)', opacity: item.status === 'Voided' ? 0.4 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{item.productName}</div>
          {item.modifiers?.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              {item.modifiers.map((m) => m.name).join(' · ')}
            </div>
          )}
          {item.note && <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 2 }}>{item.note}</div>}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, flexShrink: 0 }}>
          ₹{lineTotal.toFixed(0)}
        </div>
      </div>
      {item.status !== 'Voided' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          {item.status === 'Pending' ? (
            <>
              <button onClick={onDec} style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6,
                width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)',
              }}><Minus size={11} /></button>
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
              <button onClick={onInc} style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6,
                width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)',
              }}><Plus size={11} /></button>
              <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', marginLeft: 'auto', padding: '4px' }}>
                <Trash2 size={13} />
              </button>
            </>
          ) : (
            /* Sent items can only be voided, not removed */
            <button onClick={onVoid} style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 6,
              padding: '3px 8px', cursor: 'pointer', color: 'var(--red)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Ban size={11} /> Void
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrderScreen() {
  const { activeOrder, setActiveOrder, categories, products, tables, navigate, showToast, user } = useApp();
  const [activeCat, setActiveCat] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(activeOrder);
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([]);
  const isServer = user?.role === 'Server';
  const table = tables.find((t) => t.id === order?.tableId);

  useEffect(() => {
    discountsApi.getAll().then((r) => setDiscounts(r.data.filter((d) => d.isActive))).catch(() => {});
  }, []);

  const filteredProducts = useMemo(() =>
    products
      .filter((p) => p.isActive)
      .filter((p) => activeCat === 'all' || p.categoryId === activeCat)
      .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [products, activeCat, search]
  );

  // Only show non-voided items in cart
  const activeItems = useMemo(() => order?.items?.filter((i) => i.status !== 'Voided') ?? [], [order]);

  // Badge count per product
  const cartCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activeItems.forEach((i) => { counts[i.productId] = (counts[i.productId] ?? 0) + i.quantity; });
    return counts;
  }, [activeItems]);

  const subtotal = activeItems.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const discount = Number(order?.discount ?? 0);
  const total = subtotal + tax - discount;

  const refreshOrder = async () => {
    if (!order) return;
    try {
      const updated = await ordersApi.getById(order.id);
      setOrder(updated.data);
      setActiveOrder(updated.data);
    } catch { /* silent */ }
  };

  const addItem = async (product: Product, modifiers: Modifier[] = []) => {
    if (!order) { showToast('No active order'); return; }
    // If product has modifiers and none chosen yet, open modifier picker
    if (product.modifiers && product.modifiers.length > 0 && modifiers.length === 0) {
      setModifierProduct(product);
      setSelectedModifiers([]);
      return;
    }
    const modifierTotal = modifiers.reduce((s, m) => s + Number(m.price), 0);
    const existing = activeItems.find(
      (i) => i.productId === product.id && i.modifiers?.length === 0 && modifiers.length === 0
    );
    try {
      if (existing && modifiers.length === 0) {
        await ordersApi.updateItemQty(order.id, existing.id, existing.quantity + 1);
      } else {
        await ordersApi.addItem(order.id, {
          productId: product.id,
          productName: product.name,
          unitPrice: Number(product.price) + modifierTotal,
          quantity: 1,
          modifiers: modifiers.map((m) => ({ id: m.id, name: m.name, price: Number(m.price) })),
        });
      }
      await refreshOrder();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Failed to add item');
    }
  };

  const confirmModifiers = () => {
    if (!modifierProduct) return;
    const product = modifierProduct;
    setModifierProduct(null);
    addItem(product, selectedModifiers);
  };

  const toggleModifier = (mod: Modifier) => {
    setSelectedModifiers((prev) =>
      prev.find((m) => m.id === mod.id) ? prev.filter((m) => m.id !== mod.id) : [...prev, mod]
    );
  };

  const updateQty = async (item: OrderItem, delta: number) => {
    if (!order) return;
    const newQty = item.quantity + delta;
    try {
      if (newQty <= 0) {
        await ordersApi.removeItem(order.id, item.id);
      } else {
        await ordersApi.updateItemQty(order.id, item.id, newQty);
      }
      await refreshOrder();
    } catch { showToast('Failed to update'); }
  };

  const removeItem = async (item: OrderItem) => {
    if (!order) return;
    try {
      await ordersApi.removeItem(order.id, item.id);
      await refreshOrder();
    } catch { showToast('Failed to remove'); }
  };

  const voidItem = async (item: OrderItem) => {
    if (!order) return;
    try {
      await ordersApi.voidItem(order.id, item.id);
      await refreshOrder();
      showToast('Item voided');
    } catch { showToast('Failed to void item'); }
  };

  const applyDiscount = async (discountId?: string) => {
    if (!order) return;
    try {
      if (!discountId) {
        await ordersApi.applyDiscount(order.id, { type: 'FIXED', value: 0 });
      } else {
        const disc = discounts.find((d) => d.id === discountId);
        if (!disc) return;
        await ordersApi.applyDiscount(order.id, {
          type: disc.type === 'Percentage' ? 'PERCENTAGE' : 'FIXED',
          value: disc.value,
        });
      }
      await refreshOrder();
      setShowDiscountModal(false);
    } catch { showToast('Failed to apply discount'); }
  };

  const sendToKitchen = async () => {
    if (!order || activeItems.length === 0) { showToast('Add items first'); return; }
    const pendingItems = order.items.filter((i) => i.status === 'Pending');
    if (pendingItems.length === 0) { showToast('All items already sent'); return; }
    setSendLoading(true);
    try {
      const res = await ordersApi.send(order.id);
      setOrder(res.data); setActiveOrder(res.data);
      showToast('Sent to kitchen');
      if (isServer) navigate('FloorPlan');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'Failed to send');
    } finally { setSendLoading(false); }
  };

  if (!order) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <p>No active order. Select a table or start a takeaway order.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => navigate('FloorPlan')}>← Floor Plan</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left: Catalog */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 0 20px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingRight: 20 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 9px' }} onClick={() => navigate('FloorPlan')}>
            ← Floor
          </button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            {table ? `Table ${table.number}` : 'Takeaway'}
            <span style={{ color: 'var(--text-3)', fontSize: 14, marginLeft: 6 }}>#{order.orderNumber}</span>
          </h1>
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input className="input" placeholder="Search…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 28, width: 150 }}
            />
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, paddingRight: 20, flexShrink: 0 }}>
          <button className={`btn ${activeCat === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: 12, flexShrink: 0 }} onClick={() => setActiveCat('all')}>All</button>
          {categories.filter((c) => c.isActive).map((cat) => (
            <button key={cat.id}
              className={`btn ${activeCat === cat.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 12, flexShrink: 0 }} onClick={() => setActiveCat(cat.id)}
            >{cat.name}</button>
          ))}
        </div>

        {/* Products grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, overflowY: 'auto', paddingRight: 20 }}>
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} count={cartCounts[product.id] ?? 0} onAdd={() => addItem(product)} />
          ))}
          {filteredProducts.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-3)', padding: 40, fontSize: 13 }}>
              No items found
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div style={{
        width: 340, background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', height: '100%',
        boxShadow: '-4px 0 12px rgba(28,24,20,0.04)',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Order</span>
          <span className={`badge ${order.status === 'Sent' ? 'badge-amber' : order.status === 'Paid' ? 'badge-green' : 'badge-muted'}`}>
            {order.status}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px' }}>
          {activeItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '36px 0', fontSize: 13 }}>Add items to start</div>
          ) : (
            activeItems.map((item) => (
              <CartItem key={item.id} item={item}
                onInc={() => updateQty(item, 1)}
                onDec={() => updateQty(item, -1)}
                onRemove={() => removeItem(item)}
                onVoid={() => voidItem(item)}
              />
            ))
          )}
        </div>

        {/* Totals */}
        <div style={{ padding: 18, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', marginBottom: 5 }}>
            <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', marginBottom: 5 }}>
            <span>GST (5%)</span><span>₹{tax.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--green)', marginBottom: 5 }}>
              <span>Discount</span><span>−₹{discount.toFixed(2)}</span>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 16, color: 'var(--text)', fontWeight: 700,
            paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 6, marginBottom: 14,
          }}>
            <span>Total</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: 20 }}>₹{total.toFixed(2)}</span>
          </div>

          <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 8, fontSize: 12 }}
            onClick={() => setShowDiscountModal(true)}>
            <Tag size={12} />
            {discount > 0 ? `Discount: −₹${discount.toFixed(0)}` : 'Apply Discount'}
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-surface" style={{ flex: 1 }}
              onClick={sendToKitchen} disabled={sendLoading || activeItems.length === 0}>
              <Send size={13} /> {sendLoading ? '…' : 'Fire'}
            </button>
            {!isServer && (
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => navigate('Payment')} disabled={activeItems.length === 0}>
                Charge <ChevronRight size={13} />
              </button>
            )}
          </div>
          {isServer && activeItems.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>
              Fire to kitchen. Cashier handles payment.
            </p>
          )}
        </div>
      </div>

      {/* Modifier selection modal */}
      {modifierProduct && (
        <div className="modal-overlay">
          <div className="card" style={{ width: 360, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
                  {modifierProduct.name}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Select modifiers (optional)</div>
              </div>
              <button onClick={() => setModifierProduct(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
              {modifierProduct.modifiers?.map((mod) => {
                const active = !!selectedModifiers.find((m) => m.id === mod.id);
                return (
                  <button key={mod.id} onClick={() => toggleModifier(mod)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: active ? 'var(--accent-bg)' : 'var(--surface)',
                    transition: 'all 120ms',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, border: active ? 'none' : '1.5px solid var(--border)',
                        background: active ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {active && <Check size={11} color="#fff" strokeWidth={2.5} />}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{mod.name}</span>
                    </div>
                    {Number(mod.price) > 0 && (
                      <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>+₹{Number(mod.price).toFixed(0)}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => confirmModifiers()}>
                Skip & Add
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmModifiers}>
                Add to Order
                {selectedModifiers.length > 0 && (
                  <span style={{ fontSize: 11, opacity: 0.85 }}>
                    {' '}+₹{selectedModifiers.reduce((s, m) => s + Number(m.price), 0).toFixed(0)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount modal */}
      {showDiscountModal && (
        <div className="modal-overlay">
          <div className="card" style={{ width: 320, padding: 22 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--text)', margin: '0 0 14px', letterSpacing: '-0.02em' }}>
              Discounts
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
              {discounts.map((d) => (
                <button key={d.id} className="btn btn-ghost"
                  style={{ justifyContent: 'space-between', fontSize: 13 }} onClick={() => applyDiscount(d.id)}>
                  <span>{d.name}</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    {d.type === 'Percentage' ? `${d.value}%` : `₹${d.value}`}
                  </span>
                </button>
              ))}
              {discounts.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0' }}>
                  No discounts configured in Settings.
                </p>
              )}
            </div>
            {discount > 0 && (
              <button className="btn btn-danger" style={{ width: '100%', marginBottom: 7 }} onClick={() => applyDiscount(undefined)}>
                Remove Discount
              </button>
            )}
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setShowDiscountModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
