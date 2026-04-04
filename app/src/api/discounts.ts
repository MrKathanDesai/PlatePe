import client from './client';
import type { Discount } from '../types';

export const discountsApi = {
  getAll: () =>
    client.get<Discount[]>('/discounts'),

  create: (data: { name: string; type: 'Percentage' | 'Fixed'; value: number; approvalThreshold?: number }) =>
    client.post<Discount>('/discounts', data),

  update: (id: string, data: Partial<Discount>) =>
    client.patch<Discount>(`/discounts/${id}`, data),

  delete: (id: string) =>
    client.delete(`/discounts/${id}`),
};
