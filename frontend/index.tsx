
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import VerifyCertificatePage from './components/VerifyCertificatePage';
import './index.css';
import { initHrlI18n } from './lib/hrl/hrl-i18n';
import { PAIRS } from './lib/hrl/dict';

// English is the main language; Polish via the switcher, ?lang=pl or the shared hrl_lang cookie.
initHrlI18n({ pairs: PAIRS, storageKey: 'me_lang' });

console.log("App initializing...");
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Could not find root element to mount to");
  throw new Error("Could not find root element to mount to");
}

console.log("Root element found, rendering...");
const root = ReactDOM.createRoot(rootElement);
const isVerifyRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/verify/');
root.render(
  <React.StrictMode>
    <AuthProvider>
      {isVerifyRoute ? <VerifyCertificatePage /> : <App />}
    </AuthProvider>
  </React.StrictMode>
);
