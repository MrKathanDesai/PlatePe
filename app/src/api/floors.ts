import client from './client';
import type { Floor } from '../types';

export const floorsApi = {
  getAll: () =>
    client.get<Floor[]>('/floors'),

  create: (data: {
    name: string;
    sortOrder?: number;
    width?: number;
    height?: number;
    isActive?: boolean;
  }) =>
    client.post<Floor>('/floors', data),

  update: (id: string, data: Partial<{
    name: string;
    sortOrder: number;
    width: number;
    height: number;
    isActive: boolean;
  }>) =>
    client.patch<Floor>(`/floors/${id}`, data),

  delete: (id: string) =>
    client.delete(`/floors/${id}`),
};
