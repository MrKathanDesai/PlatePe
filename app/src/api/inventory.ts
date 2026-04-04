import client from './client';
import type { InventoryItem, InventoryTransaction } from '../types';

export const inventoryApi = {
  getAll: () =>
    client.get<InventoryItem[]>('/inventory'),

  getLowStock: () =>
    client.get<InventoryItem[]>('/inventory/low-stock'),

  getTransactions: (ingredientId?: string) =>
    client.get<InventoryTransaction[]>('/inventory/transactions', { params: ingredientId ? { ingredientId } : {} }),

  adjust: (data: { productId: string; adjustment: number; reason?: string }) =>
    client.post<InventoryItem>('/inventory/adjust', data),

  importIngredients: (rows: Array<{
    code: string;
    name: string;
    category?: string | null;
    baseUnit: string;
    onHandQty?: number;
    lowStockThreshold?: number;
    parLevel?: number;
    costPerUnit?: number;
    isActive?: boolean;
  }>) =>
    client.post<{ rows: number; created: number; updated: number }>(
      '/inventory/import/ingredients',
      { rows },
    ),

  importRecipes: (rows: Array<{
    productCode?: string;
    productName?: string;
    ingredientCode: string;
    quantity: number;
    unit?: string;
    wastePct?: number;
  }>, replaceExisting = false) =>
    client.post<{ rows: number; created: number; updated: number }>(
      '/inventory/import/recipes',
      { rows, replaceExisting },
    ),
};
