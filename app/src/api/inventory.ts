import client from './client';
import type { InventoryItem } from '../types';

export const inventoryApi = {
  getAll: () =>
    client.get<InventoryItem[]>('/inventory'),

  getLowStock: () =>
    client.get<InventoryItem[]>('/inventory/low-stock'),

  adjust: (data: { productId: string; adjustment: number; reason?: string }) =>
    client.post<InventoryItem>('/inventory/adjust', data),
};
