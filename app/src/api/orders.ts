import client from './client';
import type { Order } from '../types';

export const ordersApi = {
  getAll: (params?: { tableId?: string; sessionId?: string; status?: string }) =>
    client.get<Order[]>('/orders', { params }),

  getById: (id: string) =>
    client.get<Order>(`/orders/${id}`),

  // Create an empty order — items are added separately
  create: (data: { tableId?: string; sessionId: string }) =>
    client.post<Order>('/orders', { ...data, items: [] }),

  // Backend expects: { items: [{ productId, productName, unitPrice, quantity, note? }] }
  addItem: (orderId: string, item: {
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    note?: string;
    modifiers?: { id: string; name: string; price: number }[];
  }) =>
    client.post<Order>(`/orders/${orderId}/items`, { items: [item] }),

  // PATCH /orders/:id/items/:itemId — qty update
  updateItemQty: (orderId: string, itemId: string, quantity: number) =>
    client.patch<Order>(`/orders/${orderId}/items/${itemId}`, { quantity }),

  // DELETE /orders/:id/items/:itemId
  removeItem: (orderId: string, itemId: string) =>
    client.delete<Order>(`/orders/${orderId}/items/${itemId}`),

  send: (orderId: string) =>
    client.post<Order>(`/orders/${orderId}/send`),

  // Backend expects: { type: 'PERCENTAGE'|'FIXED', value: number }
  applyDiscount: (orderId: string, data: { type: 'PERCENTAGE' | 'FIXED'; value: number }) =>
    client.patch<Order>(`/orders/${orderId}/discount`, data),

  setTip: (orderId: string, tip: number) =>
    client.patch<Order>(`/orders/${orderId}/tip`, { tip }),

  voidItem: (orderId: string, itemId: string, reason?: string) =>
    client.patch<Order>(`/orders/${orderId}/items/${itemId}/void`, { reason }),

  void: (orderId: string) =>
    client.patch<Order>(`/orders/${orderId}/void`),

  cancel: (orderId: string) =>
    client.delete<{ deleted: true }>(`/orders/${orderId}`),
};
