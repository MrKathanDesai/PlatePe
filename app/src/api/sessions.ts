import client from './client';
import type { Session, Terminal } from '../types';

export const sessionsApi = {
  getActive: () =>
    client.get<Session | null>('/sessions/active'),

  open: (data: { terminalId: string; openingBalance: number }) =>
    client.post<Session>('/sessions/open', data),

  close: (id: string, closingBalance: number) =>
    client.post<Session>(`/sessions/${id}/close`, { closingBalance }),

  getAll: () =>
    client.get<Session[]>('/sessions'),

  getById: (id: string) =>
    client.get<Session>(`/sessions/${id}`),

  // Terminals
  getTerminals: () =>
    client.get<Terminal[]>('/terminals'),

  createTerminal: (data: { name: string; location?: string }) =>
    client.post<Terminal>('/terminals', data),
};
