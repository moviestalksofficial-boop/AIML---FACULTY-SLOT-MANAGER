import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Allow env fallbacks so the app does not crash when placeholders are missing.
if (typeof window !== 'undefined') {
  if (typeof window.__firebase_config === 'undefined' && import.meta.env.VITE_FIREBASE_CONFIG) {
    window.__firebase_config = import.meta.env.VITE_FIREBASE_CONFIG;
  }
  if (typeof window.__initial_auth_token === 'undefined' && import.meta.env.VITE_INITIAL_AUTH_TOKEN) {
    window.__initial_auth_token = import.meta.env.VITE_INITIAL_AUTH_TOKEN;
  }
  if (typeof window.__app_id === 'undefined' && import.meta.env.VITE_APP_ID) {
    window.__app_id = import.meta.env.VITE_APP_ID;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
