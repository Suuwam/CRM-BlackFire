import { useEffect, useState } from 'react';
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
import Apply from './pages/Apply';
import Accounts from './pages/Accounts';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppShell() {
  const { user, loading, login, logout } = useAuth();
  const location = useLocation();
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    setRouteLoading(true);
    const timer = setTimeout(() => setRouteLoading(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="intentional-loader">
        <div className="spinner-large" />
      </div>
    );
  }

  if (!user) {
    return (
      <ToastProvider>
        <Routes>
          <Route path="/apply" element={<Apply />} />
          <Route path="*" element={<Auth onLogin={login} />} />
        </Routes>
        <Toast />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="layout">
        <Sidebar user={user} onLogout={logout} routeLoading={routeLoading} />
        <div className="main" style={{ position: 'relative' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/clients"    element={<Clients />} />
            <Route path="/calendar"   element={<Calendar />} />
            <Route path="/email"      element={<Email />} />
            <Route path="/references" element={<References />} />
            <Route path="/board"      element={<Board />} />
            <Route path="/accounts"   element={<Accounts />} />
            <Route path="/apply"      element={<Apply />} />
            <Route path="*"           element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
        <Toast />
      </div>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
