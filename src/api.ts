export const BASE_URL = 'http://localhost:4000/api';
const TOKEN_KEY = 'platepe_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ApiModifier {
  id: string;
  name: string;
  price: number;
}

export interface ApiProduct {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  image: string;
  stockQty: number;
  is86d: boolean;
  modifiers: ApiModifier[];
}

export interface ApiTable {
  id: string;
  number: string;
  seats: number;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Needs Attention' | 'Unpaid';
  currentBill: number | null;
  occupiedSince: string | null;
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T | { message?: string; error?: string }) : null;

  if (!response.ok) {
    const maybeError = data as { message?: string; error?: string } | null;
    const message = maybeError?.message || maybeError?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  return parseResponse<T>(response);
}

async function authenticatedRequest<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const resolvedToken = token || getStoredToken();

  if (!resolvedToken) {
    throw new Error('Missing authentication token');
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolvedToken}`,
      ...(init.headers || {}),
    },
  });

  return parseResponse<T>(response);
}

// Auth
export async function loginUser(email: string, password: string): Promise<{ accessToken: string; user: ApiUser }> {
  const result = await request<{ accessToken: string; user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  setStoredToken(result.accessToken);
  return result;
}

export async function getUsers(token: string): Promise<ApiUser[]> {
  return authenticatedRequest<ApiUser[]>('/auth/users', token);
}

export async function deactivateUser(id: string, token: string): Promise<void> {
  await authenticatedRequest<void>(`/auth/users/${id}/deactivate`, token, {
    method: 'PATCH',
  });
}

export async function reactivateUser(id: string, token: string): Promise<void> {
  await authenticatedRequest<void>(`/auth/users/${id}/reactivate`, token, {
    method: 'PATCH',
  });
}

export async function registerUser(
  data: { name: string; email: string; password: string; role: string },
  token: string,
): Promise<ApiUser> {
  return authenticatedRequest<ApiUser>('/auth/register', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Products
export async function getCategories(): Promise<ApiCategory[]> {
  return request<ApiCategory[]>('/categories');
}

export async function getProducts(categoryId?: string): Promise<ApiProduct[]> {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
  return request<ApiProduct[]>(`/products${query}`);
}

// Tables
export async function getTables(token: string): Promise<ApiTable[]> {
  return authenticatedRequest<ApiTable[]>('/tables', token);
}
export async function updateTableStatus(id: string, status: string, token: string): Promise<ApiTable> {
  return authenticatedRequest<ApiTable>(`/tables/${id}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Orders
export interface ApiOrderItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity?: number;
  modifiers?: { id: string; name: string; price: number }[];
  note?: string;
}

export interface ApiOrder {
  id: string;
  orderNumber: string;
  sessionId: string;
  tableId: string | null;
  source: string;
  status: 'Open' | 'Sent' | 'Paid' | 'Voided';
  subtotal: number;
  tax: number;
  discount: number;
  tip: number;
  total: number;
  items: {
    id: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    modifiers: { id: string; name: string; price: number }[];
    note: string | null;
    status: 'Pending' | 'Sent' | 'Done' | 'Voided';
  }[];
  createdAt: string;
  updatedAt: string;
}

export async function createOrder(
  data: { sessionId: string; tableId?: string; source?: string; items?: ApiOrderItem[] },
  token: string,
): Promise<ApiOrder> {
  return authenticatedRequest<ApiOrder>('/orders', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function addItemsToOrder(
  orderId: string,
  items: ApiOrderItem[],
  token: string,
): Promise<ApiOrder> {
  return authenticatedRequest<ApiOrder>(`/orders/${orderId}/items`, token, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function sendOrderToKitchen(orderId: string, token: string): Promise<ApiOrder> {
  return authenticatedRequest<ApiOrder>(`/orders/${orderId}/send`, token, {
    method: 'POST',
  });
}

export async function cancelOrder(orderId: string, token: string): Promise<{ deleted: true }> {
  return authenticatedRequest<{ deleted: true }>(`/orders/${orderId}`, token, {
    method: 'DELETE',
  });
}

export async function getOrders(
  query: { tableId?: string; sessionId?: string; status?: string },
  token: string,
): Promise<ApiOrder[]> {
  const params = new URLSearchParams();
  if (query.tableId) params.set('tableId', query.tableId);
  if (query.sessionId) params.set('sessionId', query.sessionId);
  if (query.status) params.set('status', query.status);
  const qs = params.toString();
  return authenticatedRequest<ApiOrder[]>(`/orders${qs ? `?${qs}` : ''}`, token);
}

// Sessions & Terminals
export interface ApiTerminal {
  id: string;
  name: string;
  location: string | null;
  isLocked: boolean;
  lockedByUserId: string | null;
  createdAt: string;
}

export interface ApiSession {
  id: string;
  userId: string;
  terminalId: string;
  openingBalance: number;
  closingBalance: number | null;
  status: 'ACTIVE' | 'CLOSED';
  startTime: string;
  endTime: string | null;
}

export async function getTerminals(token: string): Promise<ApiTerminal[]> {
  return authenticatedRequest<ApiTerminal[]>('/terminals', token);
}

export async function createTerminal(
  data: { name: string; location?: string },
  token: string,
): Promise<ApiTerminal> {
  return authenticatedRequest<ApiTerminal>('/terminals', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getActiveSession(token: string): Promise<ApiSession | null> {
  try {
    return await authenticatedRequest<ApiSession>('/sessions/active', token);
  } catch {
    return null;
  }
}

export async function openSession(
  data: { terminalId: string; openingBalance: number },
  token: string,
): Promise<ApiSession> {
  return authenticatedRequest<ApiSession>('/sessions/open', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function closeSession(
  id: string,
  data: { closingBalance: number },
  token: string,
): Promise<ApiSession> {
  return authenticatedRequest<ApiSession>(`/sessions/${id}/close`, token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// KDS
export interface ApiKDSTicket {
  id: string;
  orderId: string;
  orderNumber: string;
  tableNumber: string | null;
  station: 'BREWBAR' | 'KITCHEN';
  type: 'NEW' | 'ADDON' | 'CANCEL';
  stage: 'TO_COOK' | 'PREPARING' | 'DONE';
  items: {
    itemId: string;
    name: string;
    quantity: number;
    note?: string | null;
    modifiers: { name: string; price: number }[];
  }[];
  receivedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export async function getKDSTickets(
  token: string,
  station?: 'BREWBAR' | 'KITCHEN',
): Promise<{ TO_COOK: ApiKDSTicket[]; PREPARING: ApiKDSTicket[] }> {
  const qs = station ? `?station=${station}` : '';
  return authenticatedRequest<{ TO_COOK: ApiKDSTicket[]; PREPARING: ApiKDSTicket[] }>(`/kds/tickets${qs}`, token);
}

export async function getKDSAllTickets(
  token: string,
  station?: 'BREWBAR' | 'KITCHEN',
): Promise<ApiKDSTicket[]> {
  const qs = station ? `?station=${station}` : '';
  return authenticatedRequest<ApiKDSTicket[]>(`/kds/tickets/all${qs}`, token);
}

export async function advanceKDSTicket(id: string, token: string): Promise<ApiKDSTicket> {
  return authenticatedRequest<ApiKDSTicket>(`/kds/tickets/${id}/stage`, token, {
    method: 'PATCH',
  });
}

// Payments
export interface ApiPayment {
  id: string;
  orderId: string;
  method: 'CASH' | 'DIGITAL' | 'UPI';
  amount: number;
  status: 'PENDING' | 'CONFIRMED' | 'REFUNDED';
  upiRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createPayment(
  data: { orderId: string; method: 'CASH' | 'DIGITAL' | 'UPI'; amount: number },
  token: string,
): Promise<ApiPayment> {
  return authenticatedRequest<ApiPayment>('/payments', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function confirmPayment(id: string, token?: string): Promise<ApiPayment> {
  return authenticatedRequest<ApiPayment>(`/payments/${id}/confirm`, token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// Reporting
export interface ApiDailySummary {
  date: string;
  orderCount: string;
  subtotal: string;
  tax: string;
  discount: string;
  tip: string;
  total: string;
}

export interface ApiProductPerformance {
  productId: string;
  name: string;
  totalQty: string;
  revenue: string;
}

export interface ApiAuditEntry {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  orderId: string | null;
  amount: number | null;
  reason: string | null;
  timestamp: string;
}

export async function getReportingDaily(
  token: string,
  params?: { from?: string; to?: string },
): Promise<ApiDailySummary[]> {
  const cleanParams: Record<string, string> = {};
  if (params?.from) cleanParams.from = params.from;
  if (params?.to) cleanParams.to = params.to;
  const qs = new URLSearchParams(cleanParams).toString();
  return authenticatedRequest<ApiDailySummary[]>(`/reports/daily${qs ? `?${qs}` : ''}`, token);
}

export async function getReportingProducts(
  token: string,
  params?: { from?: string; to?: string },
): Promise<ApiProductPerformance[]> {
  const cleanParams: Record<string, string> = {};
  if (params?.from) cleanParams.from = params.from;
  if (params?.to) cleanParams.to = params.to;
  const qs = new URLSearchParams(cleanParams).toString();
  return authenticatedRequest<ApiProductPerformance[]>(`/reports/products${qs ? `?${qs}` : ''}`, token);
}

export async function getReportingAudit(
  token: string,
  params?: { from?: string; to?: string; action?: string },
): Promise<ApiAuditEntry[]> {
  const cleanParams: Record<string, string> = {};
  if (params?.from) cleanParams.from = params.from;
  if (params?.to) cleanParams.to = params.to;
  if (params?.action) cleanParams.action = params.action;
  const qs = new URLSearchParams(cleanParams).toString();
  return authenticatedRequest<ApiAuditEntry[]>(`/reports/audit${qs ? `?${qs}` : ''}`, token);
}

