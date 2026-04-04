import client from './client';
import type { Product, Category, Modifier, KDSStation } from '../types';

export const productsApi = {
  getAll: (params?: { categoryId?: string; includeInactive?: boolean }) =>
    client.get<Product[]>('/products', { params }),

  getById: (id: string) =>
    client.get<Product>(`/products/${id}`),

  create: (data: {
    name: string;
    price: number;
    categoryId?: string;
    description?: string | null;
    image?: string | null;
    costPrice?: number;
    taxRate?: number;
    sendToKitchen?: boolean;
    isActive?: boolean;
    is86d?: boolean;
    lowStockThreshold?: number;
    modifierIds?: string[];
  }) =>
    client.post<Product>('/products', data),

  update: (id: string, data: Partial<{
    name: string;
    price: number;
    costPrice: number;
    taxRate: number;
    categoryId: string;
    description: string | null;
    image: string | null;
    isActive: boolean;
    modifierIds: string[];
  }>) =>
    client.patch<Product>(`/products/${id}`, data),

  delete: (id: string) =>
    client.delete(`/products/${id}`),

  /** Toggle 86 (sold-out) status. Backend: PATCH /products/:id/86 (flips the boolean) */
  toggle86: (id: string) =>
    client.patch<Product>(`/products/${id}/86`),

  // Categories
  getCategories: () =>
    client.get<Category[]>('/categories'),

  createCategory: (data: { name: string; sortOrder?: number; station?: KDSStation }) =>
    client.post<Category>('/categories', data),

  // Modifiers
  getModifiers: () =>
    client.get<Modifier[]>('/modifiers'),

  createModifier: (data: { name: string; price?: number }) =>
    client.post<Modifier>('/modifiers', data),
};
