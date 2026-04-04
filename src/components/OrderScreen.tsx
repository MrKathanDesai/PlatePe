import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, CheckCircle2, Banknote, Smartphone, CreditCard, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Category, Order, OrderItem, Product } from '../types';
import {
  getCategories,
  getProducts,
  createOrder,
  addItemsToOrder,
  sendOrderToKitchen,
  createPayment,
  confirmPayment,
  updateTableStatus,
  getToken,
} from '../api';

interface OrderScreenProps {
  activeOrder: Order | null;
  sessionId: string | null;
  onOpenSession: () => void;
  onOrderComplete: (tableId?: string) => void;
}

type PaymentMethod = 'CASH' | 'DIGITAL' | 'UPI';

function formatCurrency(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTableLabel(tableId?: string) {
  if (!tableId) return null;
  const n = tableId.trim().toUpperCase();
  return n.startsWith('T') ? `Table ${n}` : `Table T${n}`;
}

function PaymentModal({
  total,
  orderId,
  tableId,
  onSuccess,
  onClose,
}: {
  total: number;
  orderId: string;
  tableId?: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleCharge = async () => {
    setError('');
    setSubmitting(true);
    const token = getToken();
    if (!token) { setError('Not authenticated'); setSubmitting(false); return; }

    try {
      const payment = await createPayment({ orderId, method, amount: total }, token);
      await confirmPayment(payment.id, token);
      if (tableId) {
        await updateTableStatus(tableId, 'Available', token).catch(() => {});
      }
      setDone(true);
      setTimeout(onSuccess, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setSubmitting(false);
    }
  };

  const methodOptions: { key: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { key: 'CASH', label: 'Cash', icon: <Banknote size={16} /> },
    { key: 'DIGITAL', label: 'Card / Digital', icon: <CreditCard size={16} /> },
    { key: 'UPI', label: 'UPI', icon: <Smartphone size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-white rounded-2xl shadow-2xl border border-zinc-100"
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 py-12 px-6">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <p className="text-base font-semibold text-zinc-900">Payment Successful</p>
            <p className="text-sm text-zinc-500">₹{formatCurrency(total)} via {method}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Charge Customer</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Total due: <span className="font-bold text-zinc-900">₹{formatCurrency(total)}</span></p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-600">Payment Method</p>
                <div className="grid grid-cols-3 gap-2">
                  {methodOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setMethod(opt.key)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 transition-all ${
                        method === opt.key
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      {opt.icon}
                      <span className="text-[11px] font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
                  <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleCharge}
                disabled={submitting}
                className="w-full rounded-xl bg-[#16a34a] py-3 text-sm font-semibold text-white transition-all hover:bg-green-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Processing…</>
                ) : (
                  `Collect ₹${formatCurrency(total)}`
                )}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function OrderScreen({ activeOrder, sessionId, onOpenSession, onOrderComplete }: OrderScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [backendOrderId, setBackendOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<'idle' | 'sending' | 'sent' | 'charging' | 'done'>('idle');
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const apiCategories = await getCategories();
        const mapped = apiCategories.map((c) => ({ id: c.id, name: c.name }));
        setCategories(mapped);
        if (mapped.length > 0) setSelectedCategory(mapped[0].id);
      } catch {
        setCategories([]);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!selectedCategory) { setProducts([]); return; }
    setIsLoadingProducts(true);
    getProducts(selectedCategory)
      .then((items) =>
        setProducts(items.map((p) => ({
          id: p.id,
          name: p.name,
          categoryId: p.categoryId,
          price: p.price,
          image: p.image,
          stockQty: p.stockQty,
          is86d: p.is86d,
          modifiers: p.modifiers,
        })))
      )
      .catch(() => setProducts([]))
      .finally(() => setIsLoadingProducts(false));
  }, [selectedCategory]);

  const addToCart = (product: Product) => {
    if (product.is86d) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, {
        id: Math.random().toString(36).slice(2, 11),
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        modifiers: [],
        status: 'Pending',
      }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) =>
      prev.map((item) => item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item)
        .filter((item) => item.quantity > 0),
    );
  };

  const increaseQuantity = (itemId: string) => {
    setCart((prev) => prev.map((item) => item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item));
  };

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;
  const tableLabel = getTableLabel(activeOrder?.tableId);

  const getOrCreateOrder = async (token: string): Promise<string> => {
    if (backendOrderId) return backendOrderId;
    if (!sessionId) throw new Error('No active session. Please open a session first.');
    const order = await createOrder(
      {
        sessionId,
        tableId: activeOrder?.tableId || undefined,
        source: 'POS',
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.name,
          unitPrice: item.price,
          quantity: item.quantity,
          modifiers: item.modifiers.map((m) => ({ id: m.id, name: m.name, price: m.price })),
        })),
      },
      token,
    );
    setBackendOrderId(order.id);
    return order.id;
  };

  const handleSendToKitchen = async () => {
    if (cart.length === 0) return;
    if (!sessionId) { onOpenSession(); return; }

    setError('');
    setOrderStatus('sending');
    const token = getToken();
    if (!token) { setError('Not authenticated'); setOrderStatus('idle'); return; }

    try {
      const orderId = await getOrCreateOrder(token);
      // If order already existed, add new items
      if (backendOrderId) {
        await addItemsToOrder(orderId, cart.map((item) => ({
          productId: item.productId,
          productName: item.name,
          unitPrice: item.price,
          quantity: item.quantity,
          modifiers: item.modifiers.map((m) => ({ id: m.id, name: m.name, price: m.price })),
        })), token);
      }
      await sendOrderToKitchen(orderId, token);
      if (activeOrder?.tableId) {
        await updateTableStatus(activeOrder.tableId, 'Occupied', token).catch(() => {});
      }
      setOrderStatus('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send to kitchen');
      setOrderStatus('idle');
    }
  };

  const handleCharge = async () => {
    if (cart.length === 0) return;
    if (!sessionId) { onOpenSession(); return; }

    setError('');
    const token = getToken();
    if (!token) { setError('Not authenticated'); return; }

    try {
      const orderId = await getOrCreateOrder(token);
      // If not yet sent to kitchen, send it now
      if (orderStatus !== 'sent') {
        if (backendOrderId) {
          await addItemsToOrder(orderId, cart.map((item) => ({
            productId: item.productId,
            productName: item.name,
            unitPrice: item.price,
            quantity: item.quantity,
            modifiers: item.modifiers.map((m) => ({ id: m.id, name: m.name, price: m.price })),
          })), token);
        }
        await sendOrderToKitchen(orderId, token).catch(() => {});
      }
      setBackendOrderId(orderId);
      setShowPaymentModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare order');
    }
  };

  const isSent = orderStatus === 'sent';

  return (
    <div className="flex h-full overflow-hidden bg-[#fafaf8] text-zinc-900">
      {/* Product grid */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-zinc-100 bg-white px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {isLoadingCategories
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-8 w-24 shrink-0 rounded-full bg-zinc-100 animate-pulse" />
                ))
              : categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={
                      selectedCategory === category.id
                        ? 'shrink-0 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white'
                        : 'shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700'
                    }
                  >
                    {category.name}
                  </button>
                ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingProducts ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-zinc-100 bg-white">
                  <div className="aspect-[4/3] w-full animate-pulse bg-zinc-100" />
                  <div className="space-y-2 p-3">
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-100" />
                    <div className="h-3.5 w-1/3 animate-pulse rounded bg-zinc-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-400">No items in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {products.map((product) => {
                const inCart = cart.find((i) => i.productId === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.is86d}
                    className="group relative overflow-hidden rounded-2xl border border-zinc-100 bg-white text-left transition-all hover:border-zinc-300 hover:shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {product.is86d && (
                      <span className="absolute right-2 top-2 z-10 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        86&apos;d
                      </span>
                    )}
                    {inCart && !product.is86d && (
                      <span className="absolute right-2 top-2 z-10 rounded-md bg-[#16a34a] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {inCart.quantity}
                      </span>
                    )}

                    <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-50">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-2xl text-zinc-200">☕</div>
                      )}
                    </div>

                    <div className="p-3">
                      <p className="text-[13px] font-semibold text-zinc-900 leading-tight">{product.name}</p>
                      <p className="mt-1 text-[13px] font-bold text-zinc-700">₹{formatCurrency(product.price)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Order sidebar */}
      <aside className="w-80 border-l border-zinc-100 bg-white flex flex-col xl:w-96">
        <header className="border-b border-zinc-100 px-5 pt-5 pb-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              {isSent ? 'Order Sent' : 'Current Order'}
            </h2>
            <div className="flex items-center gap-2">
              {isSent && (
                <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  In Kitchen
                </span>
              )}
              {tableLabel && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                  {tableLabel}
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <p className="text-sm text-zinc-300">No items yet</p>
              <p className="text-xs text-zinc-200">Tap a product to add it</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2.5">
                  <p className="flex-1 text-[13px] text-zinc-800 leading-snug">{item.name}</p>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-600 transition hover:bg-zinc-200 active:scale-95"
                    >
                      −
                    </button>
                    <span className="min-w-[1.5rem] text-center text-xs font-semibold text-zinc-700">{item.quantity}</span>
                    <button
                      onClick={() => increaseQuantity(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-600 transition hover:bg-zinc-200 active:scale-95"
                    >
                      +
                    </button>
                  </div>

                  <p className="w-16 text-right text-[13px] font-semibold text-zinc-900">
                    ₹{formatCurrency(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="space-y-3 border-t border-zinc-100 px-4 py-4">
          {/* Totals */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Subtotal</span>
              <span className="font-medium text-zinc-700">₹{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>GST (5%)</span>
              <span className="font-medium text-zinc-700">₹{formatCurrency(tax)}</span>
            </div>
            <div className="h-px w-full bg-zinc-100 my-1" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900">Total</span>
              <span className="text-base font-bold text-zinc-900">₹{formatCurrency(total)}</span>
            </div>
          </div>

          {/* No session warning */}
          {!sessionId && (
            <button
              onClick={onOpenSession}
              className="w-full flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors text-left"
            >
              <AlertCircle size={14} className="shrink-0" />
              No active session — tap to open one
            </button>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2">
              <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleSendToKitchen}
            disabled={cart.length === 0 || orderStatus === 'sending'}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              isSent
                ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                : 'bg-[#111111] text-white hover:bg-zinc-800'
            }`}
          >
            {orderStatus === 'sending' && <Loader2 size={14} className="animate-spin" />}
            {orderStatus === 'sending' ? 'Sending…' : isSent ? 'Add More Items' : 'Send to Kitchen'}
          </button>

          <button
            onClick={handleCharge}
            disabled={cart.length === 0}
            className="w-full rounded-xl bg-[#16a34a] py-2.5 text-sm font-semibold text-white transition-all hover:bg-green-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Charge ₹{formatCurrency(total)}
          </button>
        </footer>
      </aside>

      <AnimatePresence>
        {showPaymentModal && backendOrderId && (
          <PaymentModal
            total={total}
            orderId={backendOrderId}
            tableId={activeOrder?.tableId}
            onSuccess={() => {
              setShowPaymentModal(false);
              setCart([]);
              setBackendOrderId(null);
              setOrderStatus('idle');
              onOrderComplete(activeOrder?.tableId);
            }}
            onClose={() => setShowPaymentModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
