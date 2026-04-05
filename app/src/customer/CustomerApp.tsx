import { useEffect } from 'react';
import { CustomerProvider, useCustomer } from './CustomerContext';
import OtpLoginScreen from './screens/OtpLoginScreen';
import MenuScreen from './screens/MenuScreen';
import OrderStatusScreen from './screens/OrderStatusScreen';
import CustomerPaymentScreen from './screens/CustomerPaymentScreen';
import { customerApi } from './api/customerApi';
import { getCustomerSocket, disconnectCustomerSocket } from '../api/kds';

function CustomerShell({ tableId }: { tableId: string | null }) {
  const { screen, setTable, setScreen, token, orderId, logout } = useCustomer();

  // Fetch table info on mount
  useEffect(() => {
    if (!tableId) return;
    customerApi.getTableSession(tableId)
      .then((res) => setTable(res.table.id, res.table.number, res.sessionActive))
      .catch(() => {});
  }, [tableId, setTable]);

  // If token exists but screen is login, go to menu
  useEffect(() => {
    if (token && screen === 'login') setScreen('menu');
  }, [token, screen, setScreen]);

  // Global order:paid listener — auto-logout no matter which screen the customer is on
  useEffect(() => {
    if (!token || !orderId) return;

    const socket = getCustomerSocket();

    const handlePaid = (data: { orderId: string }) => {
      if (data.orderId !== orderId) return;
      // Small delay so the customer sees a brief confirmation if already on status screen
      setTimeout(() => logout(), 2500);
    };

    socket.on('order:paid', handlePaid);

    return () => {
      socket.off('order:paid', handlePaid);
    };
  }, [token, orderId, logout]);

  // Disconnect customer socket on unmount
  useEffect(() => {
    return () => {
      disconnectCustomerSocket();
    };
  }, []);

  switch (screen) {
    case 'login':   return <OtpLoginScreen />;
    case 'menu':    return <MenuScreen />;
    case 'status':  return <OrderStatusScreen />;
    case 'payment': return <CustomerPaymentScreen />;
    default:        return <MenuScreen />;
  }
}

export default function CustomerApp() {
  const path = window.location.pathname;
  const search = new URLSearchParams(window.location.search);
  const tableId =
    search.get('table') ??
    (path.replace(/^\/customer\/?/, '').split('/')[0] || null);

  return (
    <CustomerProvider tableId={tableId}>
      <CustomerShell tableId={tableId} />
    </CustomerProvider>
  );
}
