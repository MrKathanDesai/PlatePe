import client from './client';
import type { Table, TableStatus } from '../types';

export const tablesApi = {
  getAll: () =>
    client.get<Table[]>('/tables'),

  create: (data: {
    number: string;
    seats?: number;
    floorId?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    shape?: string;
    rotation?: number;
  }) =>
    client.post<Table>('/tables', data),

  update: (id: string, data: Partial<{
    number: string;
    seats: number;
    floorId: string | null;
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
    shape: string | null;
    rotation: number;
  }>) =>
    client.patch<Table>(`/tables/${id}`, data),

  updateStatus: (id: string, status: TableStatus) =>
    client.patch<Table>(`/tables/${id}/status`, { status }),

  transfer: (id: string, data: { toTableId: string; orderId: string }) =>
    client.patch<Table>(`/tables/${id}/transfer`, data),

  delete: (id: string) =>
    client.delete(`/tables/${id}`),
};
