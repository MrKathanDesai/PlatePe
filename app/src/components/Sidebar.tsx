import { LayoutDashboard, MapPin, ShoppingCart, ChefHat, BarChart2, Settings, LogOut, CreditCard, Coffee, Sun, Moon } from 'lucide-react';
import { useApp } from '../store/app-store-context';
import { ROLE_SCREENS } from '../store/roleConfig';
import type { Screen, UserRole } from '../types';

const ROLE_LABELS: Record<UserRole, string> = {
  Admin:    'Administrator',
  Manager:  'Manager',
  Cashier:  'Cashier',
  Server:   'Server',
  Barista:  'Barista',
  Chef:     'Chef',
};

interface NavItem { label: string; icon: React.ReactNode; screen: Screen }

const ALL_NAV: NavItem[] = [
  { label: 'Dashboard',   icon: <LayoutDashboard size={15} />, screen: 'Dashboard' },
  { label: 'Floor Plan',  icon: <MapPin size={15} />,          screen: 'FloorPlan' },
  { label: 'Order',       icon: <ShoppingCart size={15} />,    screen: 'Order' },
  { label: 'Pay Queue',   icon: <CreditCard size={15} />,      screen: 'CashierQueue' },
  { label: 'Kitchen KDS', icon: <ChefHat size={15} />,         screen: 'KDS' },
  { label: 'Brewbar KDS', icon: <Coffee size={15} />,          screen: 'Brewbar' },
  { label: 'Reports',     icon: <BarChart2 size={15} />,       screen: 'Reporting' },
  { label: 'Settings',    icon: <Settings size={15} />,        screen: 'Settings' },
];

export default function Sidebar() {
  const { screen, navigate, logout, user, theme, toggleTheme } = useApp();
  const allowed = ROLE_SCREENS[user?.role ?? 'Admin'];
  const items = ALL_NAV.filter((item) => allowed.includes(item.screen));

  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      background: 'var(--surface)',
      borderRight: '1.5px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Brand */}
      <div style={{ padding: '22px 18px 16px' }}>
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}>
          plate<span style={{ color: 'var(--accent)' }}>pe</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-3)',
            letterSpacing: '0.06em',
            marginLeft: 6,
            verticalAlign: 'middle',
          }}>POS</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <span className="role-label">{ROLE_LABELS[user?.role ?? 'Admin']}</span>
        </div>
      </div>

      <hr className="divider" />

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
        {items.map((item) => {
          const active = screen === item.screen;
          return (
            <button
              key={item.screen}
              onClick={() => navigate(item.screen)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 'var(--radius)',
                border: active ? '1.5px solid var(--accent-mid)' : '1.5px solid transparent',
                cursor: 'pointer',
                marginBottom: 1,
                background: active ? 'var(--accent-bg)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-2)',
                fontSize: 13,
                fontFamily: 'var(--font-ui)',
                fontWeight: active ? 600 : 400,
                transition: 'all 100ms',
                textAlign: 'left',
                boxShadow: active ? 'var(--shadow-hard-sm)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'var(--surface-2)';
                  el.style.color = 'var(--text)';
                  el.style.borderColor = 'var(--border)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'transparent';
                  el.style.color = 'var(--text-2)';
                  el.style.borderColor = 'transparent';
                }
              }}
            >
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <hr className="divider" />

      {/* User + controls */}
      <div style={{ padding: '12px' }}>
        {/* Theme toggle row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 9px',
              borderRadius: 'var(--radius)',
              border: '1.5px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              letterSpacing: '0.04em',
              transition: 'all 100ms',
              boxShadow: 'var(--shadow-hard-sm)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = 'var(--surface-3)';
              el.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = 'var(--surface-2)';
              el.style.color = 'var(--text-2)';
            }}
          >
            {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
            {theme === 'dark' ? 'LIGHT' : 'DARK'}
          </button>
        </div>

        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30,
            borderRadius: 'var(--radius)',
            background: 'var(--accent-bg)',
            border: '1.5px solid var(--accent-mid)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 12, color: 'var(--accent)', fontWeight: 700, flexShrink: 0,
          }}>
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name ?? 'User'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', fontSize: 12 }} onClick={logout}>
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </aside>
  );
}
