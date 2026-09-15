import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { configMissing } from './firebase';

function ConfigMissingNotice() {
  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: 24, textAlign: 'center', color: '#E8ECF4', background: '#131B2E', borderRadius: 16, border: '1px solid #232E48' }}>
      <h2 style={{ marginTop: 0 }}>Almost there</h2>
      <p style={{ color: '#8B96AD', fontSize: 14 }}>
        Open <code>src/firebaseConfig.js</code>, paste in your Firebase project config, then rebuild/redeploy.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {configMissing ? (
      <ConfigMissingNotice />
    ) : (
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    )}
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((e) => console.error('SW registration failed', e));
  });
}
