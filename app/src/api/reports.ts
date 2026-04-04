import client from './client';
import type { DailyReport, ProductReport, HourlyHeatmap, AuditLog, Session } from '../types';

export const reportsApi = {
  daily: (params?: { from?: string; to?: string }) =>
    client.get<DailyReport[]>('/reports/daily', { params }),

  products: (params?: { from?: string; to?: string }) =>
    client.get<ProductReport[]>('/reports/products', { params }),

  hourlyHeatmap: (params?: { from?: string; to?: string }) =>
    client.get<HourlyHeatmap[]>('/reports/hourly-heatmap', { params }),

  audit: (params?: { action?: string; limit?: number }) =>
    client.get<AuditLog[]>('/reports/audit', { params }),

  session: (sessionId: string) =>
    client.get<{
      session: Session;
      totalOrders: number;
      paidOrders: number;
      voidedOrders: number;
      totalRevenue: number;
      paymentBreakdown: { method: string; total: number }[];
      discrepancy: number;
    }>(`/reports/session/${sessionId}`),

  tableTurnover: (params?: { from?: string; to?: string }) =>
    client.get<{ tableId: string; turnovers: number; avgMinutes: number }[]>(
      '/reports/table-turnover', { params }),
};
