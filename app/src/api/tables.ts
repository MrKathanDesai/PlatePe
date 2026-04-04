import client from './client';
import type { Table, TableStatus } from '../types';

export const tablesApi = {
  getAll: () =>
    client.get<Table[]>('/tables'),

  create: (data: { number: string; seats?: number; floorId?: string }) =>
    client.post<Table>('/tables', data),

  updateStatus: (id: string, status: TableStatus) =>
    client.patch<Table>(`/tables/${id}/status`, { status }),

  transfer: (id: string, data: { toTableId: string; orderId: string }) =>
    client.patch<Table>(`/tables/${id}/transfer`, data),

  delete: (id: string) =>
    client.delete(`/tables/${id}`),
};
