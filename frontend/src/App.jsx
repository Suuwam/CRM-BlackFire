import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Calendar from './pages/Calendar';
import Email from './pages/Email';
import References from './pages/References';
import Board from './pages/Board';
import Auth from './pages/Auth';
import { ToastProvider } from './components/Toast';

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem('crm_auth') === 'true';
  });

  function handleLogout() {
    sessionStorage.removeItem('crm_auth');
    setAuthenticated(false);
  }

  if (!authenticated) {
    return (
      <ToastProvider>
        <Auth onLogin={() => setAuthenticated(true)} />
        <Toast />
      </ToastProvider>
    );
  }

  const location = useLocation();
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    setRouteLoading(true);
    const timer = setTimeout(() => setRouteLoading(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <ToastProvider>
      <div className="layout">
        <Sidebar onLogout={handleLogout} routeLoading={routeLoading} />
        <div className="main" style={{ position: 'relative' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/clients"    element={<Clients />} />
            <Route path="/calendar"   element={<Calendar />} />
            <Route path="/email"      element={<Email />} />
            <Route path="/references" element={<References />} />
            <Route path="/board"      element={<Board />} />
          </Routes>
        </div>
        <Toast />
      </div>
    </ToastProvider>
  );
}
