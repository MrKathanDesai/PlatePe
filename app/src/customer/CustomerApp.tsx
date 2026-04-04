import { useEffect, useState } from 'react';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth, firebaseAuthEnabled } from './firebase';
import { CustomerProvider, useCustomer } from './CustomerContext';
import OtpLoginScreen from './screens/OtpLoginScreen';
import MenuScreen from './screens/MenuScreen';
import OrderStatusScreen from './screens/OrderStatusScreen';
import CustomerPaymentScreen from './screens/CustomerPaymentScreen';
import { customerApi } from './api/customerApi';

const handledEmailLinkKeys = new Set<string>();

function getCleanCustomerUrl() {
  const params = new URLSearchParams(window.location.search);
  const preservedTable = params.get('table');
  const nextParams = new URLSearchParams();

  if (preservedTable) {
    nextParams.set('table', preservedTable);
  }

  const query = nextParams.toString();
  return query ? `${window.location.pathname}?${query}` : window.location.pathname;
}

function CustomerShell({ tableId }: { tableId: string | null }) {
  const { screen, setTable, setScreen, token, setAuth } = useCustomer();

  const [emailLinkLoading, setEmailLinkLoading] = useState(false);
  const [emailLinkError, setEmailLinkError] = useState('');
  // Shown when link opens in a different browser (Gmail WebView etc.)
  const [emailNeeded, setEmailNeeded] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');

  // Fetch table info on mount
  useEffect(() => {
    if (!tableId) return;
    customerApi.getTableSession(tableId)
      .then((res) => setTable(res.table.id, res.table.number, res.sessionActive))
      .catch(() => {});
  }, [tableId, setTable]);

  // Complete email magic-link sign-in if this is the redirect
  useEffect(() => {
    if (!firebaseAuthEnabled || !auth) return;
    if (!isSignInWithEmailLink(auth!, window.location.href)) return;

    // Priority: URL param (cross-browser safe) → localStorage (same browser)
    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('emailForSignIn');
    const savedEmail = emailFromUrl ?? localStorage.getItem('customer_email_for_signin');

    if (!savedEmail) {
      // Opened in a different browser with no email in URL — ask user to re-enter
      setEmailNeeded(window.location.href);
      return;
    }

    const attemptKey = `${savedEmail}::${window.location.href}`;
    if (handledEmailLinkKeys.has(attemptKey)) return;

    handledEmailLinkKeys.add(attemptKey);
    void completeEmailSignIn(savedEmail);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function completeEmailSignIn(emailAddress: string) {
    setEmailLinkLoading(true);
    setEmailLinkError('');
    try {
      const credential = await signInWithEmailLink(auth!, emailAddress, window.location.href);
      localStorage.removeItem('customer_email_for_signin');
      const idToken = await credential.user.getIdToken();
      const res = await customerApi.verifyFirebaseToken(idToken);
      setAuth(res.token, res.customer);
      // Clean Firebase query params but preserve the customer table reference.
      window.history.replaceState({}, document.title, getCleanCustomerUrl());
      setEmailNeeded('');
    } catch (e: any) {
      console.error('Email link sign-in error:', e.code, e.message);
      setEmailLinkError(
        e.code === 'auth/invalid-action-code'
          ? 'This sign-in link has expired or already been used. Please request a new one.'
          : e.message?.replace('Firebase: ', '') ?? 'Sign-in failed',
      );
    } finally {
      setEmailLinkLoading(false);
    }
  }

  // If token exists but screen is login, go to menu
  useEffect(() => {
    if (token && screen === 'login') setScreen('menu');
  }, [token, screen, setScreen]);

  // ── Email prompt for cross-browser scenario ───────────────────────────────
  if (emailNeeded) {
    return (
      <div style={promptStyles.page}>
        <div style={promptStyles.card}>
          <div style={promptStyles.logo}>
            <span style={{ fontSize: 26 }}>🍽</span>
            <span style={promptStyles.logoText}>PlatePe</span>
          </div>
          <h2 style={promptStyles.heading}>Confirm your email</h2>
          <p style={promptStyles.sub}>
            You opened the sign-in link in a different browser. Enter your email to continue.
          </p>
          <input
            style={promptStyles.input}
            type="email"
            placeholder="you@example.com"
            value={emailConfirm}
            onChange={(e) => setEmailConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && completeEmailSignIn(emailConfirm)}
            autoFocus
          />
          {emailLinkError && <p style={promptStyles.error}>{emailLinkError}</p>}
          <button
            style={{ ...promptStyles.btn, opacity: emailLinkLoading ? 0.65 : 1 }}
            onClick={() => completeEmailSignIn(emailConfirm)}
            disabled={emailLinkLoading || !emailConfirm.includes('@')}
          >
            {emailLinkLoading ? 'Signing in…' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  // ── Loading while processing email link ───────────────────────────────────
  if (emailLinkLoading) {
    return (
      <div style={promptStyles.page}>
        <div style={{ textAlign: 'center' }}>
          <div style={promptStyles.spinner} />
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 16, fontFamily: 'system-ui' }}>
            Signing you in…
          </p>
        </div>
      </div>
    );
  }

  if (emailLinkError && !emailNeeded) {
    return (
      <div style={promptStyles.page}>
        <div style={promptStyles.card}>
          <div style={promptStyles.logo}>
            <span style={{ fontSize: 26 }}>🍽</span>
            <span style={promptStyles.logoText}>PlatePe</span>
          </div>
          <p style={promptStyles.error}>{emailLinkError}</p>
          <button
            style={promptStyles.btn}
            onClick={() => { setEmailLinkError(''); window.history.replaceState({}, document.title, getCleanCustomerUrl()); }}
          >
            Back to login
          </button>
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

const promptStyles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: 'linear-gradient(160deg, #FFF8F2 0%, #FFF0E4 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "var(--font-ui)",
  },
  card: {
    background: '#fff',
    borderRadius: 24,
    padding: '36px 28px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 8px 40px rgba(196,98,45,0.10)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  logoText: {
    fontFamily: "var(--font-ui)",
    fontSize: 24,
    fontWeight: 600,
    color: 'var(--accent)',
  },
  heading: {
    fontFamily: "var(--font-ui)",
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 8px',
  },
  sub: { fontSize: 14, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 },
  input: {
    width: '100%',
    border: '1.5px solid #DDD8D0',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 15,
    color: 'var(--text)',
    background: '#FAFAF8',
    outline: 'none',
    fontFamily: "var(--font-ui)",
    boxSizing: 'border-box',
    marginBottom: 12,
  },
  btn: {
    width: '100%',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "var(--font-ui)",
  },
  error: {
    color: 'var(--red)',
    fontSize: 13,
    padding: '8px 12px',
    background: 'rgba(184,50,50,0.07)',
    borderRadius: 8,
    marginBottom: 12,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #DDD8D0',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
};
