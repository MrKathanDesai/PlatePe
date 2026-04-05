import { useEffect, useReducer, useCallback, type ReactNode } from 'react';
import type { User, Session, Order, Table, Product, Category, Floor, Screen, UserRole } from '../types';
import { sessionsApi } from '../api/sessions';
import { productsApi } from '../api/products';
import { tablesApi } from '../api/tables';
import { floorsApi } from '../api/floors';
import { AppContext } from './app-store-context';
import { ROLE_HOME } from './roleConfig';

// ─── State ────────────────────────────────────────────────────────────────────
interface AppState {
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
}

type Action =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_SESSION'; payload: Session | null }
  | { type: 'SET_ACTIVE_ORDER'; payload: Order | null }
  | { type: 'SET_ACTIVE_TABLE'; payload: string | null }
  | { type: 'SET_TABLES'; payload: Table[] }
  | { type: 'SET_FLOORS'; payload: Floor[] }
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'NAVIGATE'; payload: { screen: Screen; params?: Record<string, unknown> } }
  | { type: 'SHOW_TOAST'; payload: string }
  | { type: 'CLEAR_TOAST' }
  | { type: 'TOGGLE_THEME' };

const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') ?? 'light';

const initialState: AppState = {
  user: null, session: null, activeOrder: null, activeTableId: null,
  tables: [], floors: [], products: [], categories: [],
  screen: 'Login', screenParams: {}, toast: null,
  theme: savedTheme,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':         return { ...state, user: action.payload };
    case 'SET_SESSION':      return { ...state, session: action.payload };
    case 'SET_ACTIVE_ORDER': return { ...state, activeOrder: action.payload };
    case 'SET_ACTIVE_TABLE': return { ...state, activeTableId: action.payload };
    case 'SET_TABLES':       return { ...state, tables: action.payload };
    case 'SET_FLOORS':       return { ...state, floors: action.payload };
    case 'SET_PRODUCTS':     return { ...state, products: action.payload };
    case 'SET_CATEGORIES':   return { ...state, categories: action.payload };
    case 'NAVIGATE':         return { ...state, screen: action.payload.screen, screenParams: action.payload.params ?? {} };
    case 'SHOW_TOAST':       return { ...state, toast: { message: action.payload, id: Date.now() } };
    case 'CLEAR_TOAST':      return { ...state, toast: null };
    case 'TOGGLE_THEME': {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return { ...state, theme: next };
    }
    default: return state;
  }
}

// ─── Role → data-role attribute ──────────────────────────────────────────────
function applyRoleTheme(role: UserRole | undefined) {
  document.body.setAttribute('data-role', role ?? 'Admin');
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Apply saved theme on mount
  useEffect(() => {
    applyTheme(state.theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const [tablesRes, floorsRes, productsRes, categoriesRes] = await Promise.all([
        tablesApi.getAll(),
        floorsApi.getAll(),
        productsApi.getAll(),
        productsApi.getCategories(),
      ]);
      dispatch({ type: 'SET_TABLES', payload: tablesRes.data });
      dispatch({ type: 'SET_FLOORS', payload: floorsRes.data });
      dispatch({ type: 'SET_PRODUCTS', payload: productsRes.data });
      dispatch({ type: 'SET_CATEGORIES', payload: categoriesRes.data });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson) as User;
        applyRoleTheme(user.role);
        dispatch({ type: 'SET_USER', payload: user });
        sessionsApi.getActive()
          .then((r) => dispatch({ type: 'SET_SESSION', payload: r.data }))
          .catch(() => {});
        dispatch({ type: 'NAVIGATE', payload: { screen: ROLE_HOME[user.role] } });
        void loadInitialData();
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, [loadInitialData]);

  useEffect(() => {
    if (state.toast) {
      const t = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3200);
      return () => clearTimeout(t);
    }
  }, [state.toast]);

  useEffect(() => {
    if (!state.user) return;
    const id = setInterval(() => {
      tablesApi.getAll().then((r) => dispatch({ type: 'SET_TABLES', payload: r.data })).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [state.user]);

  const login = useCallback(async (user: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    applyRoleTheme(user.role);
    dispatch({ type: 'SET_USER', payload: user });
    try {
      const r = await sessionsApi.getActive();
      dispatch({ type: 'SET_SESSION', payload: r.data });
    } catch { /* no active session */ }
    await loadInitialData();
    dispatch({ type: 'NAVIGATE', payload: { screen: ROLE_HOME[user.role] } });
  }, [loadInitialData]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.body.removeAttribute('data-role');
    dispatch({ type: 'SET_USER',         payload: null });
    dispatch({ type: 'SET_SESSION',      payload: null });
    dispatch({ type: 'SET_ACTIVE_ORDER', payload: null });
    dispatch({ type: 'NAVIGATE',         payload: { screen: 'Login' } });
  }, []);

  const navigate = useCallback((screen: Screen, params?: Record<string, unknown>) => {
    dispatch({ type: 'NAVIGATE', payload: { screen, params } });
  }, []);

  const setSession      = useCallback((s: Session | null) => dispatch({ type: 'SET_SESSION',      payload: s }), []);
  const setActiveOrder  = useCallback((o: Order | null)   => dispatch({ type: 'SET_ACTIVE_ORDER', payload: o }), []);
  const setActiveTable  = useCallback((id: string | null) => dispatch({ type: 'SET_ACTIVE_TABLE', payload: id }), []);

  const refreshTables   = useCallback(async () => {
    const r = await tablesApi.getAll();
    dispatch({ type: 'SET_TABLES', payload: r.data });
  }, []);

  const refreshFloors   = useCallback(async () => {
    const r = await floorsApi.getAll();
    dispatch({ type: 'SET_FLOORS', payload: r.data });
  }, []);

  const refreshProducts = useCallback(async () => {
    const [p, c] = await Promise.all([productsApi.getAll(), productsApi.getCategories()]);
    dispatch({ type: 'SET_PRODUCTS',   payload: p.data });
    dispatch({ type: 'SET_CATEGORIES', payload: c.data });
  }, []);

  const showToast = useCallback((msg: string) => dispatch({ type: 'SHOW_TOAST', payload: msg }), []);
  const toggleTheme = useCallback(() => dispatch({ type: 'TOGGLE_THEME' }), []);

  return (
    <AppContext.Provider value={{
      ...state,
      login, logout, navigate,
      setSession, setActiveOrder, setActiveTable,
      refreshTables, refreshFloors, refreshProducts, showToast, toggleTheme,
    }}>
      {children}
    </AppContext.Provider>
  );
}
