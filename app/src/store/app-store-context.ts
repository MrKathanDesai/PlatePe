import { createContext, useContext } from 'react';
import type { User, Session, Order, Table, Product, Category, Floor, Screen } from '../types';

export interface AppContextValue {
  user: User | null;
  session: Session | null;
  activeOrder: Order | null;
  activeTableId: string | null;
  tables: Table[];
  floors: Floor[];
  products: Product[];
  categories: Category[];
  screen: Screen;
  screenParams: Record<string, unknown>;
  toast: { message: string; id: number } | null;
  theme: 'light' | 'dark';
  login: (user: User, token: string) => Promise<void>;
  logout: () => void;
  navigate: (screen: Screen, params?: Record<string, unknown>) => void;
  setSession: (session: Session | null) => void;
  setActiveOrder: (order: Order | null) => void;
  setActiveTable: (tableId: string | null) => void;
  refreshTables: () => Promise<void>;
  refreshFloors: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  showToast: (message: string) => void;
  toggleTheme: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
