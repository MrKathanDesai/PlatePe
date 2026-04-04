import { useEffect, useState } from 'react';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth, firebaseAuthEnabled } from './firebase';
import { CustomerProvider, useCustomer } from './CustomerContext';
import OtpLoginScreen from './screens/OtpLoginScreen';
import MenuScreen from './screens/MenuScreen';
import OrderStatusScreen from './screens/OrderStatusScreen';
import CustomerPaymentScreen from './screens/CustomerPaymentScreen';
import { customerApi } from './api/customerApi';

function CustomerShell({ tableId }: { tableId: string | null }) {
  const { screen, setTable, setScreen, token, setAuth } = useCustomer();
  const [emailLinkLoading, setEmailLinkLoading] = useState(false);

  // Fetch table info on mount
  useEffect(() => {
    if (!tableId) return;
    customerApi.getTableSession(tableId)
      .then((res) => setTable(res.table.id, res.table.number, res.sessionActive))
      .catch(() => {/* table not found */});
  }, [tableId, setTable]);

  // Complete email magic-link sign-in if this is the redirect
  useEffect(() => {
    if (!firebaseAuthEnabled || !auth) return;
    if (!isSignInWithEmailLink(auth!, window.location.href)) return;

    const savedEmail = localStorage.getItem('customer_email_for_signin');
    if (!savedEmail) return; // user opened link on a different device — would need to re-enter email

    setEmailLinkLoading(true);
    signInWithEmailLink(auth!, savedEmail, window.location.href)
      .then(async (credential) => {
        localStorage.removeItem('customer_email_for_signin');
        const idToken = await credential.user.getIdToken();
        const res = await customerApi.verifyFirebaseToken(idToken);
        setAuth(res.token, res.customer);
        // Clean URL so it doesn't re-trigger on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch(() => {/* invalid/expired link — fall through to login */})
      .finally(() => setEmailLinkLoading(false));
  }, [setAuth]);

  // If token exists but we're on login screen, push to menu
  useEffect(() => {
    if (token && screen === 'login') setScreen('menu');
  }, [token, screen, setScreen]);

  if (emailLinkLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #DDD8D0', borderTopColor: '#C4622D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#5C5650', fontSize: 14 }}>Signing you in…</p>
        </div>
      </div>
    );
  }

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
