import client from './client';
import type { User } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    client.post<{ accessToken: string; user: User }>('/auth/login', { email, password }),

  register: (data: { name: string; email: string; password: string; role?: string }) =>
    client.post<User>('/auth/register', data),

  findAll: () =>
    client.get<User[]>('/auth/users'),

  deactivate: (id: string) =>
    client.patch(`/auth/users/${id}/deactivate`),

  reactivate: (id: string) =>
    client.patch(`/auth/users/${id}/reactivate`),
};
