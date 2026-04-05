import client from './client';
import type { Reservation, ReservationChannel, ReservationStatus } from '../types';

export const reservationsApi = {
  getAll: (params?: { from?: string; to?: string; status?: ReservationStatus | '' }) =>
    client.get<Reservation[]>('/reservations', { params }),

  getById: (id: string) =>
    client.get<Reservation>(`/reservations/${id}`),

  create: (data: {
    guestName: string;
    phone?: string | null;
    email?: string | null;
    partySize: number;
    startsAt: string;
    endsAt: string;
    status?: 'PENDING' | 'CONFIRMED';
    notes?: string | null;
    channel?: ReservationChannel;
    tableIds?: string[];
    primaryTableId?: string;
  }) =>
    client.post<Reservation>('/reservations', data),

  update: (id: string, data: Partial<{
    guestName: string;
    phone: string | null;
    email: string | null;
    partySize: number;
    startsAt: string;
    endsAt: string;
    status: ReservationStatus;
    notes: string | null;
    channel: ReservationChannel;
  }>) =>
    client.patch<Reservation>(`/reservations/${id}`, data),

  assign: (id: string, data: { tableIds: string[]; primaryTableId?: string }) =>
    client.post<Reservation>(`/reservations/${id}/assign`, data),

  seat: (id: string) =>
    client.post<Reservation>(`/reservations/${id}/seat`),

  cancel: (id: string) =>
    client.post<Reservation>(`/reservations/${id}/cancel`),

  noShow: (id: string) =>
    client.post<Reservation>(`/reservations/${id}/no-show`),

  complete: (id: string) =>
    client.post<Reservation>(`/reservations/${id}/complete`),
};
