import client from './client';
import type { KDSTicket, KDSStation } from '../types';
import { io, Socket } from 'socket.io-client';

export const kdsApi = {
  /** GET /kds/tickets?station=KITCHEN|BREWBAR — returns { TO_COOK, PREPARING } */
  getActive: (station?: KDSStation) =>
    client.get<{ TO_COOK: KDSTicket[]; PREPARING: KDSTicket[] }>('/kds/tickets', {
      params: station ? { station } : undefined,
    }),

  /** GET /kds/tickets/all?station=... — last 100 tickets */
  getAll: (station?: KDSStation) =>
    client.get<KDSTicket[]>('/kds/tickets/all', {
      params: station ? { station } : undefined,
    }),

  advanceStage: (id: string) =>
    client.patch<KDSTicket>(`/kds/tickets/${id}/stage`),
};

let socket: Socket | null = null;

export function getKDSSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('token');
    // In production, connect directly to the Render backend.
    // In development, use the current origin (Vite proxies /socket.io).
    const serverUrl = import.meta.env.VITE_API_URL || window.location.origin;
    socket = io('/kds', {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
      ...(import.meta.env.VITE_API_URL ? { host: serverUrl } : {}),
    });
  }
  return socket;
}

export function disconnectKDSSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
