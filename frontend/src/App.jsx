import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import SearchPalette from './components/SearchPalette';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Calendar from './pages/Calendar';
import Email from './pages/Email';
import References from './pages/References';
import Board from './pages/Board';
import Auth from './pages/Auth';
import Apply from './pages/Apply';
import Accounts from './pages/Accounts';
import AssignedTasks from './pages/AssignedTasks';
import Backlog from './pages/Backlog';
import Overdue from './pages/Overdue';
import TopBar from './components/TopBar';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Apply saved theme on initial load (before React renders)
(function initTheme() {
  const theme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;
  root.classList.remove('dark', 'theme-ocean', 'theme-dusk');
  if (theme === 'dark') root.classList.add('dark');
  localStorage.setItem('theme', theme);
})();

function AppShell() {
  const { user, loading, login, logout } = useAuth();
  const location = useLocation();
  const [routeLoading, setRouteLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setRouteLoading(true);
    const timer = setTimeout(() => setRouteLoading(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(open => !open);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

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
        <Sidebar
          user={user}
          onLogout={logout}
          routeLoading={routeLoading}
          onSearchOpen={() => setSearchOpen(true)}
        />
        <div className="main" style={{ position: 'relative' }}>
          <TopBar />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/assigned" element={<AssignedTasks />} />
            <Route path="/backlog" element={<Backlog />} />
            <Route path="/overdue" element={<Overdue />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/email" element={<Email />} />
            <Route path="/references" element={<References />} />
            <Route path="/board" element={<Board />} />
            <Route path="/accounts" element={<Accounts />} />
          </Routes>
        </div>
        <Toast />
      </div>
      {/* Global Search Palette — always mounted, toggled by Cmd+K */}
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
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
