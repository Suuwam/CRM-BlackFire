import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Android app: ask to allow notifications once, on the very first launch.
if (window.Capacitor?.isNativePlatform?.()) {
  import('./components/NotificationBell').then(m => m.askPhonePermissionOnce()).catch(() => {});
}
