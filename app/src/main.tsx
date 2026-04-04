import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AppProvider } from './store/AppContext';

const CustomerApp = lazy(() => import('./customer/CustomerApp'));

const isCustomer = window.location.pathname.startsWith('/customer');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isCustomer ? (
        <CustomerApp />
      ) : (
        <AppProvider>
          <App />
        </AppProvider>
      )}
    </Suspense>
  </StrictMode>,
);
