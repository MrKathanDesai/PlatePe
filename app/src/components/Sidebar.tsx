import { LayoutDashboard, MapPin, ShoppingCart, ChefHat, BarChart2, Settings, LogOut, CreditCard, Coffee } from 'lucide-react';
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
  { label: 'Dashboard',   icon: <LayoutDashboard size={16} />, screen: 'Dashboard' },
  { label: 'Floor Plan',  icon: <MapPin size={16} />,          screen: 'FloorPlan' },
  { label: 'Order',       icon: <ShoppingCart size={16} />,    screen: 'Order' },
  { label: 'Pay Queue',   icon: <CreditCard size={16} />,      screen: 'CashierQueue' },
  { label: 'Kitchen KDS', icon: <ChefHat size={16} />,         screen: 'KDS' },
  { label: 'Brewbar KDS', icon: <Coffee size={16} />,          screen: 'Brewbar' },
  { label: 'Reports',     icon: <BarChart2 size={16} />,       screen: 'Reporting' },
  { label: 'Settings',    icon: <Settings size={16} />,        screen: 'Settings' },
];

export default function Sidebar() {
  const { screen, navigate, logout, user } = useApp();
  const allowed = ROLE_SCREENS[user?.role ?? 'Admin'];
  const items = ALL_NAV.filter((item) => allowed.includes(item.screen));

  return (
    <aside style={{
      width: 216,
      minWidth: 216,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxShadow: 'var(--shadow-xs)',
    }}>
      {/* Brand */}
      <div style={{ padding: '24px 20px 18px' }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 400,
          color: 'var(--text)',
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}>
          Plate<span style={{ color: 'var(--accent)' }}>Pe</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <span className="role-label">{ROLE_LABELS[user?.role ?? 'Admin']}</span>
        </div>
      </div>

      <hr className="divider" />

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
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
                gap: 9,
                padding: '9px 10px',
                borderRadius: 8,
                border: active ? '1px solid var(--accent-mid)' : '1px solid transparent',
                cursor: 'pointer',
                marginBottom: 2,
                background: active ? 'var(--accent-bg)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-2)',
                fontSize: 13,
                fontFamily: 'var(--font-ui)',
                fontWeight: active ? 600 : 400,
                transition: 'all 130ms',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'var(--surface-2)';
                  el.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'transparent';
                  el.style.color = 'var(--text-2)';
                }
              }}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <hr className="divider" />

      {/* User */}
      <div style={{ padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--accent-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: 'var(--accent)', fontWeight: 700, flexShrink: 0,
          }}>
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name ?? 'User'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{user?.email}</div>
          </div>
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', fontSize: 12 }} onClick={logout}>
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  );
}
