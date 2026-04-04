import { useApp } from './store/app-store-context';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import FloorPlanScreen from './screens/FloorPlanScreen';
import OrderScreen from './screens/OrderScreen';
import PaymentScreen from './screens/PaymentScreen';
import KDSScreen from './screens/KDSScreen';
import BrewbarScreen from './screens/BrewbarScreen';
import CashierQueueScreen from './screens/CashierQueueScreen';
import ReportingScreen from './screens/ReportingScreen';
import SettingsLayout from './screens/settings/SettingsLayout';
import Sidebar from './components/Sidebar';

// Chef and Barista get immersive full-screen layouts (no sidebar)
const IMMERSIVE_ROLES = ['Chef', 'Barista'];

function AppShell() {
  const { screen, user, toast } = useApp();
  const immersive = IMMERSIVE_ROLES.includes(user?.role ?? '');

  const renderScreen = () => {
    switch (screen) {
      case 'Dashboard':    return <DashboardScreen />;
      case 'FloorPlan':    return <FloorPlanScreen />;
      case 'Order':        return <OrderScreen />;
      case 'Payment':      return <PaymentScreen />;
      case 'KDS':          return <KDSScreen />;
      case 'Brewbar':      return <BrewbarScreen />;
      case 'CashierQueue': return <CashierQueueScreen />;
      case 'Reporting':    return <ReportingScreen />;
      case 'Settings':     return <SettingsLayout />;
      default:             return <DashboardScreen />;
    }
  };

  if (immersive) {
    return (
      <div style={{ height: '100%', background: 'var(--bg)' }}>
        {renderScreen()}
        {toast && <div key={toast.id} className="toast">{toast.message}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        {renderScreen()}
      </main>
      {toast && <div key={toast.id} className="toast">{toast.message}</div>}
    </div>
  );
}

export default function App() {
  const { screen } = useApp();
  if (screen === 'Login') return <LoginScreen />;
  return <AppShell />;
}
