const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('customer_token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  modifiers: { id: string; name: string; price: number }[];
}

export interface MenuCategory {
  id: string;
  name: string;
  station: string;
  products: MenuItem[];
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    status: string;
    modifiers: { id: string; name: string; price: number }[];
    note: string | null;
  }[];
}

export const customerApi = {
  verifyFirebaseToken: (idToken: string, name?: string) =>
    request<{ token: string; customer: { id: string; phone: string; name: string | null } }>(
      '/customer/auth/verify-firebase',
      { method: 'POST', body: JSON.stringify({ idToken, name }) },
    ),

  getMenu: () => request<MenuCategory[]>('/customer/menu'),

  getTableSession: (tableId: string) =>
    request<{ table: { id: string; number: number; seats: number; status: string }; sessionId: string | null; sessionActive: boolean }>(
      `/customer/table/${tableId}`,
    ),

  createOrder: (tableId: string) =>
    request<CustomerOrder>('/customer/orders', {
      method: 'POST',
      body: JSON.stringify({ tableId }),
    }),

  addItems: (
    orderId: string,
    items: {
      productId: string;
      productName: string;
      unitPrice: number;
      quantity?: number;
      modifiers?: { id: string; name: string; price: number }[];
      note?: string;
    }[],
  ) =>
    request<CustomerOrder>(`/customer/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  getOrder: (orderId: string) => request<CustomerOrder>(`/customer/orders/${orderId}`),

  createRazorpayOrder: (orderId: string) =>
    request<{ rzpOrderId: string; amount: number; currency: string; keyId: string; orderNumber: string }>(
      '/customer/payments/create',
      { method: 'POST', body: JSON.stringify({ orderId }) },
    ),

  verifyPayment: (data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    orderId: string;
  }) =>
    request<{ success: boolean; orderId: string; orderNumber: string }>('/customer/payments/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
