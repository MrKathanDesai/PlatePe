import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Map as MapIcon,
  ShoppingCart,
  ChefHat,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  X,
  Loader2,
  Monitor,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { View, User, Order } from './types';
import {
  getActiveSession,
  getTerminals,
  createTerminal,
  openSession,
  ApiSession,
  ApiTerminal,
  getToken,
} from './api';

import Dashboard from './components/Dashboard';
import FloorPlan from './components/FloorPlan';
import OrderScreen from './components/OrderScreen';
import KDS from './components/KDS';
import Reporting from './components/Reporting';
import SettingsView from './components/Settings';
import Login from './components/Login';

// ─── Open Session Modal ──────────────────────────────────────────────────────

function OpenSessionModal({
  userId,
  userRole,
  onSuccess,
  onClose,
}: {
  userId: string;
  userRole: string;
  onSuccess: (session: ApiSession) => void;
  onClose: () => void;
}) {
  const [terminals, setTerminals] = useState<ApiTerminal[]>([]);
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [selectedTerminal, setSelectedTerminal] = useState('');
  const [newTerminalName, setNewTerminalName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    getTerminals(token)
      .then((list) => {
        setTerminals(list);
        // A terminal is "mine" if it's unlocked or locked by current user
        const available = list.filter((t) => !t.isLocked || t.lockedByUserId === userId);
        if (available.length > 0) {
          setSelectedTerminal(available[0].id);
          setMode('pick');
        } else {
          // All locked by others — go straight to create-new
          setMode('new');
        }
      })
      .catch(() => { setTerminals([]); setMode('new'); })
      .finally(() => setLoading(false));
  }, [userId]);

  const availableTerminals = terminals.filter((t) => !t.isLocked || t.lockedByUserId === userId);
  const lockedByOthers = terminals.filter((t) => t.isLocked && t.lockedByUserId !== userId);
  const isAdmin = userRole === 'Admin' || userRole === 'Manager';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const token = getToken();
    if (!token) { setError('Not authenticated'); setSubmitting(false); return; }

    try {
      let terminalId = selectedTerminal;

      if (mode === 'new') {
        if (!isAdmin) {
          setError('Only Admin or Manager can create terminals.');
          setSubmitting(false);
          return;
        }
        const name = newTerminalName.trim() || 'Terminal';
        const created = await createTerminal({ name }, token);
        terminalId = created.id;
      }

      if (!terminalId) {
        setError('Please select or create a terminal.');
        setSubmitting(false);
        return;
      }

      const balance = parseFloat(openingBalance) || 0;
      const session = await openSession({ terminalId, openingBalance: balance }, token);
      onSuccess(session);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to open session';
      // Surface a friendlier message for the common conflict case
      if (msg.toLowerCase().includes('already in use')) {
        setError('That terminal is in use by someone else. Create a new one below.');
        setMode('new');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
              <Monitor size={15} className="text-zinc-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900">Open Session</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-zinc-300" />
            </div>
          ) : (
            <>
              {/* Terminal selector */}
              {availableTerminals.length > 0 && (
                <div className="flex gap-2 bg-zinc-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => { setMode('pick'); setSelectedTerminal(availableTerminals[0].id); }}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${mode === 'pick' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                  >
                    Use Existing
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setMode('new')}
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${mode === 'new' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                    >
                      New Terminal
                    </button>
                  )}
                </div>
              )}

              {mode === 'pick' && availableTerminals.length > 0 ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-600">Terminal</label>
                  <select
                    value={selectedTerminal}
                    onChange={(e) => setSelectedTerminal(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-400"
                  >
                    {availableTerminals.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.location ? ` — ${t.location}` : ''}{t.isLocked ? ' (your session)' : ''}
                      </option>
                    ))}
                  </select>
                  {lockedByOthers.length > 0 && (
                    <p className="text-[10px] text-zinc-400">
                      {lockedByOthers.map(t => t.name).join(', ')} {lockedByOthers.length === 1 ? 'is' : 'are'} in use by another user.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-600">
                    Terminal Name
                    {!isAdmin && <span className="text-zinc-400 font-normal ml-1">(Admin required)</span>}
                  </label>
                  <input
                    type="text"
                    value={newTerminalName}
                    onChange={(e) => setNewTerminalName(e.target.value)}
                    placeholder={`e.g. Counter ${terminals.length + 1}`}
                    disabled={!isAdmin}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-300 focus:outline-none focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-400"
                  />
                  {terminals.length === 0 && (
                    <p className="text-[10px] text-zinc-400">No terminals exist yet — this will create your first one.</p>
                  )}
                  {lockedByOthers.length > 0 && availableTerminals.length === 0 && (
                    <p className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg">
                      All existing terminals are in use. Create a new one to continue.
                    </p>
                  )}
                </div>
              )}

              {/* Opening balance */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-600">Opening Cash Balance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 pl-7 pr-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-zinc-400"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg leading-relaxed">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || (!isAdmin && mode === 'new')}
                className="w-full rounded-xl bg-[#111111] py-2.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? 'Opening…' : mode === 'new' ? 'Create Terminal & Open Session' : 'Open Session'}
              </button>
            </>
          )}
        </form>
      </motion.div>
    </div>
  );
}

// ─── Add Terminal Modal ──────────────────────────────────────────────────────

function AddTerminalModal({
  onSuccess,
  onClose,
}: {
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Terminal name is required'); return; }
    setError('');
    setSubmitting(true);
    const token = getToken();
    if (!token) { setError('Not authenticated'); setSubmitting(false); return; }
    try {
      await createTerminal({ name: name.trim(), location: location.trim() || undefined }, token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create terminal');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-zinc-100"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
              <Plus size={15} className="text-zinc-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900">Add Terminal</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-600">Terminal Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Barista Station"
              autoFocus
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-300 focus:outline-none focus:border-zinc-400"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-600">Location <span className="text-zinc-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Ground Floor"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-300 focus:outline-none focus:border-zinc-400"
            />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#111111] py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Creating…' : 'Create Terminal'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [currentView, setCurrentView] = useState<View>('Dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showAddTerminalModal, setShowAddTerminalModal] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

  const handleLogin = async (u: User) => {
    setUser(u);
    setCurrentView('Dashboard');
    const token = getToken();
    if (token) {
      const session = await getActiveSession(token);
      if (session) setSessionId(session.id);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('platepe_token');
    setUser(null);
    setCurrentView('Login');
    setActiveOrder(null);
    setSessionId(null);
  };

  useEffect(() => {
    const token = getToken();
    if (!token || !user) return;
    getActiveSession(token).then((s) => { if (s) setSessionId(s.id); });
  }, [user]);

  if (!user) return <Login onLogin={handleLogin} />;

  const allNavItems = [
    { id: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'FloorPlan', icon: MapIcon, label: 'Floor Plan' },
    { id: 'Orders', icon: ShoppingCart, label: 'Orders' },
    { id: 'KDS', icon: ChefHat, label: 'Kitchen' },
    { id: 'Reporting', icon: BarChart3, label: 'Reports' },
    { id: 'Settings', icon: Settings, label: 'Settings' },
  ] as const;

  const viewTitles: Record<View, string> = {
    Login: 'Login',
    Dashboard: 'Dashboard',
    FloorPlan: 'Floor Plan',
    Orders: 'New Order',
    KDS: 'Kitchen Display',
    Reporting: 'Reports',
    Settings: 'Settings',
  };

  return (
    <div className="flex min-h-[100dvh] bg-[#fafaf8] text-zinc-900 font-sans overflow-hidden [font-family:'Geist',ui-sans-serif,system-ui,sans-serif]">
      {/* Sidebar */}
      <aside className="w-16 bg-[#111111] flex flex-col items-center py-6 gap-1 border-r border-zinc-900/60">
        <div className="w-7 h-7 rounded-sm bg-[#16a34a] text-white font-black text-sm flex items-center justify-center shrink-0 mb-3">
          P
        </div>

        <nav className="flex-1 w-full flex flex-col items-center gap-1">
          {allNavItems.map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;
            return (
              <div key={item.id} className="w-full flex flex-col items-center">
                {item.id === 'Settings' && <div className="w-8 h-px bg-zinc-800/90 my-2" />}
                <div className="relative group">
                  <button
                    onClick={() => setCurrentView(item.id)}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-150 relative ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-800 hover:text-white'}`}
                    aria-label={item.label}
                  >
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[2px] bg-[#16a34a] rounded-r-sm" />}
                    <Icon size={18} />
                  </button>
                  <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-100 shadow-sm border border-zinc-700 z-50">
                    {item.label}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-2">
          <div className="relative group">
            <div className={`w-2 h-2 rounded-full ${sessionId ? 'bg-green-500' : 'bg-amber-500'}`} />
            <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-100 shadow-sm border border-zinc-700 z-50">
              {sessionId ? 'Session active' : 'No session'}
            </div>
          </div>

          <div className="relative group">
            <img
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=16a34a&fontFamily=Arial&fontSize=40`}
              alt={user.name}
              className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-700"
            />
            <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-100 shadow-sm border border-zinc-700 z-50">
              {user.name}
            </div>
          </div>

          <div className="relative group">
            <button
              onClick={handleLogout}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-all duration-150"
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-100 shadow-sm border border-zinc-700 z-50">
              Logout
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col bg-[#fafaf8] overflow-hidden">
        <header className="h-14 bg-white border-b border-zinc-100 px-6 flex items-center justify-between shrink-0">
          <h1 className="text-sm font-semibold text-zinc-800 tracking-tight">{viewTitles[currentView]}</h1>

          <div className="flex items-center gap-3">
            {!sessionId && (
              <button
                onClick={() => setShowSessionModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                No session — open one
              </button>
            )}
            <button className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all" aria-label="Notifications">
              <Bell size={17} />
            </button>
            <div className="flex items-center gap-2.5">
              <p className="text-sm font-medium text-zinc-800">{user.name}</p>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-zinc-100 text-zinc-600 border border-zinc-200">
                {user.role}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="h-full"
            >
              {currentView === 'Dashboard' && (
                <Dashboard
                  key={dashboardRefreshKey}
                  sessionId={sessionId}
                  onOpenSession={() => setShowSessionModal(true)}
                  onAddTerminal={() => setShowAddTerminalModal(true)}
                  onSessionClosed={() => setSessionId(null)}
                />
              )}
              {currentView === 'FloorPlan' && (
                <FloorPlan
                  onTableSelect={(t) => {
                    setActiveOrder({ id: '', orderNumber: '', tableId: t.id, items: [], subtotal: 0, tax: 0, discount: 0, tip: 0, total: 0, status: 'Open', createdAt: new Date().toISOString() });
                    setCurrentView('Orders');
                  }}
                />
              )}
              {currentView === 'Orders' && (
                <OrderScreen
                  activeOrder={activeOrder}
                  sessionId={sessionId}
                  onOpenSession={() => setShowSessionModal(true)}
                  onOrderComplete={(tableId) => {
                    setActiveOrder(null);
                    if (tableId) setCurrentView('FloorPlan');
                  }}
                />
              )}
              {currentView === 'KDS' && <KDS />}
              {currentView === 'Reporting' && <Reporting userRole={user.role} />}
              {currentView === 'Settings' && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showSessionModal && (
          <OpenSessionModal
            userId={user.id}
            userRole={user.role}
            onSuccess={(session) => {
              setSessionId(session.id);
              setShowSessionModal(false);
              setDashboardRefreshKey((k) => k + 1);
            }}
            onClose={() => setShowSessionModal(false)}
          />
        )}
        {showAddTerminalModal && (
          <AddTerminalModal
            onSuccess={() => {
              setShowAddTerminalModal(false);
              setDashboardRefreshKey((k) => k + 1);
            }}
            onClose={() => setShowAddTerminalModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
