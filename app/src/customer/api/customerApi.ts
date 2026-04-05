const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export type CustomerPaymentMethod = 'CASH' | 'DIGITAL' | 'UPI';

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
    request<{ token: string; customer: { id: string; phone: string | null; email: string | null; name: string | null } }>(
      '/customer/auth/verify-firebase',
      { method: 'POST', body: JSON.stringify({ idToken, name }) },
    ),

  sendEmailOtp: (email: string, name?: string) =>
    request<{ success: boolean; email: string; expiresInSeconds: number; resendAfterSeconds: number }>(
      '/customer/auth/email/send-otp',
      { method: 'POST', body: JSON.stringify({ email, name }) },
    ),

  verifyEmailOtp: (email: string, code: string, name?: string) =>
    request<{ token: string; customer: { id: string; phone: string | null; email: string | null; name: string | null } }>(
      '/customer/auth/email/verify-otp',
      { method: 'POST', body: JSON.stringify({ email, code, name }) },
    ),

  getMenu: () => request<MenuCategory[]>('/customer/menu'),

  getTableSession: (tableId: string) =>
    request<{ table: { id: string; number: string; seats: number; status: string }; sessionId: string | null; sessionActive: boolean }>(
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

  payOrder: (data: {
    orderId: string;
    method: CustomerPaymentMethod;
    upiRef?: string;
  }) =>
    request<{
      success: boolean;
      orderId: string;
      orderNumber: string;
      orderStatus: string;
      paymentId: string | null;
      paymentMethod: CustomerPaymentMethod;
      paymentRequestStatus?: 'REQUESTED' | 'CONFIRMED';
    }>('/customer/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
