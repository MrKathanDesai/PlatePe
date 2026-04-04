import React, { createContext, useContext, useState, useCallback } from 'react';

export type CustomerScreen = 'login' | 'menu' | 'cart' | 'status' | 'payment' | 'done';

export interface CartItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  modifiers: { id: string; name: string; price: number }[];
  note?: string;
  /** local key for dedup */
  key: string;
}

export interface CustomerIdentity {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
}

interface CustomerState {
  screen: CustomerScreen;
  tableId: string | null;
  tableNumber: string | null;
  sessionActive: boolean;
  token: string | null;
  customer: CustomerIdentity | null;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  orderTotal: number | null;
  cart: CartItem[];

  setScreen: (s: CustomerScreen) => void;
  setTable: (id: string, number: string, sessionActive: boolean) => void;
  setAuth: (token: string, customer: CustomerIdentity) => void;
  logout: () => void;
  setOrder: (id: string, number: string, status: string, total: number) => void;
  setOrderStatus: (status: string) => void;
  addToCart: (item: Omit<CartItem, 'key'>) => void;
  removeFromCart: (key: string) => void;
  updateQty: (key: string, delta: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
}

const CustomerCtx = createContext<CustomerState | null>(null);

function makeKey(item: Omit<CartItem, 'key'>) {
  const modKey = (item.modifiers ?? []).map((m) => m.id).sort().join(',');
  return `${item.productId}::${modKey}`;
}

export function CustomerProvider({ children, tableId }: { children: React.ReactNode; tableId: string | null }) {
  const stored = localStorage.getItem('customer_token');
  const storedCustomer = (() => {
    try { return JSON.parse(localStorage.getItem('customer_user') ?? 'null'); } catch { return null; }
  })();

  const [screen, setScreen] = useState<CustomerScreen>(stored ? 'menu' : 'login');
  const [tableNum, setTableNum] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [token, setToken] = useState<string | null>(stored);
  const [customer, setCustomer] = useState<CustomerIdentity | null>(storedCustomer);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const setTable = useCallback((_id: string, num: string, active: boolean) => {
    setTableNum(num);
    setSessionActive(active);
  }, []);

  const setAuth = useCallback((t: string, c: CustomerIdentity) => {
    localStorage.setItem('customer_token', t);
    localStorage.setItem('customer_user', JSON.stringify(c));
    setToken(t);
    setCustomer(c);
    setScreen('menu');
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    setToken(null);
    setCustomer(null);
    setCart([]);
    setOrderId(null);
    setOrderNumber(null);
    setOrderStatus(null);
    setOrderTotal(null);
    setScreen('login');
  }, []);

  const setOrder = useCallback((id: string, num: string, status: string, total: number) => {
    setOrderId(id);
    setOrderNumber(num);
    setOrderStatus(status);
    setOrderTotal(total);
  }, []);

  const addToCart = useCallback((item: Omit<CartItem, 'key'>) => {
    const key = makeKey(item);
    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + (item.quantity ?? 1) } : c);
      }
      return [...prev, { ...item, key }];
    });
  }, []);

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const updateQty = useCallback((key: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((c) => {
        if (c.key !== key) return [c];
        const newQty = c.quantity + delta;
        return newQty <= 0 ? [] : [{ ...c, quantity: newQty }];
      }),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartTotal = cart.reduce((s, c) => {
    const modsTotal = c.modifiers.reduce((ms, m) => ms + m.price, 0);
    return s + (c.unitPrice + modsTotal) * c.quantity;
  }, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <CustomerCtx.Provider
      value={{
        screen, tableId, tableNumber: tableNum, sessionActive,
        token, customer, orderId, orderNumber, orderStatus, orderTotal,
        cart, cartTotal, cartCount,
        setScreen, setTable, setAuth, logout,
        setOrder, setOrderStatus: (s) => setOrderStatus(s),
        addToCart, removeFromCart, updateQty, clearCart,
      }}
    >
      {children}
    </CustomerCtx.Provider>
  );
}

export function useCustomer() {
  const ctx = useContext(CustomerCtx);
  if (!ctx) throw new Error('useCustomer must be used within CustomerProvider');
  return ctx;
}
