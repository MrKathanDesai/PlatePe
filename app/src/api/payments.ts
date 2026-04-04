import client from './client';
import type { Payment, PaymentMethod } from '../types';

export const paymentsApi = {
  /** POST /payments — method must be CASH | DIGITAL | UPI */
  create: (data: { orderId: string; method: PaymentMethod; amount: number }) =>
    client.post<Payment>('/payments', data),

  /** POST /payments/:id/confirm — optional upiRef for UPI payments */
  confirm: (paymentId: string, upiRef?: string) =>
    client.post<Payment>(`/payments/${paymentId}/confirm`, upiRef ? { upiRef } : {}),

  getByOrder: (orderId: string) =>
    client.get<Payment[]>(`/payments/order/${orderId}`),

  split: (orderId: string, data: { mode: 'EVEN'; partySize: number }) =>
    client.post<{ mode: string; total: number; partySize: number; perPerson: number }>(
      `/payments/order/${orderId}/split`, data),

  refund: (id: string, reason: string) =>
    client.post<Payment>(`/payments/${id}/refund`, { reason }),
};
