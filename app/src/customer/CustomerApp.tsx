import { useEffect } from 'react';
import { CustomerProvider, useCustomer } from './CustomerContext';
import OtpLoginScreen from './screens/OtpLoginScreen';
import MenuScreen from './screens/MenuScreen';
import OrderStatusScreen from './screens/OrderStatusScreen';
import CustomerPaymentScreen from './screens/CustomerPaymentScreen';
import { customerApi } from './api/customerApi';

function CustomerShell({ tableId }: { tableId: string | null }) {
  const { screen, setTable, setScreen, token } = useCustomer();

  useEffect(() => {
    if (!tableId) return;
    customerApi.getTableSession(tableId)
      .then((res) => {
        setTable(res.table.id, res.table.number, res.sessionActive);
      })
      .catch(() => {/* table not found, stay on login */});
  }, [tableId, setTable]);

  // If token exists but we land on login, push to menu
  useEffect(() => {
    if (token && screen === 'login') setScreen('menu');
  }, [token, screen, setScreen]);

  switch (screen) {
    case 'login':   return <OtpLoginScreen />;
    case 'menu':    return <MenuScreen />;
    case 'status':  return <OrderStatusScreen />;
    case 'payment': return <CustomerPaymentScreen />;
    default:        return <MenuScreen />;
  }
}

export default function CustomerApp() {
  // Extract tableId from URL: /customer/:tableId or ?table=:tableId
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
