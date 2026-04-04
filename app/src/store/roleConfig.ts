import type { Screen, UserRole } from '../types';

export const ROLE_HOME: Record<UserRole, Screen> = {
  Admin: 'Dashboard',
  Manager: 'Dashboard',
  Cashier: 'CashierQueue',
  Server: 'FloorPlan',
  Barista: 'Brewbar',
  Chef: 'KDS',
};

export const ROLE_SCREENS: Record<UserRole, Screen[]> = {
  Admin: ['Dashboard', 'FloorPlan', 'Order', 'Payment', 'KDS', 'Brewbar', 'CashierQueue', 'Reporting', 'Settings'],
  Manager: ['Dashboard', 'FloorPlan', 'Order', 'Payment', 'CashierQueue', 'Reporting'],
  Cashier: ['CashierQueue', 'FloorPlan', 'Order', 'Payment'],
  Server: ['FloorPlan', 'Order'],
  Barista: ['Brewbar'],
  Chef: ['KDS'],
};
