import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import TopBar from './components/TopBar';
import PageSkeleton from './components/Skeleton';
import { ToastProvider } from './components/Toast';

// Every page is its own chunk. The shell (sidebar, top bar, auth, toasts) is all the first
// paint needs; a route's code is fetched when you navigate to it and cached from then on.
const SearchPalette = lazy(() => import('./components/SearchPalette'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const AdminDashboard= lazy(() => import('./pages/AdminDashboard'));
const Attendance    = lazy(() => import('./pages/Attendance'));
const Team          = lazy(() => import('./pages/Team'));
const Calendar      = lazy(() => import('./pages/Calendar'));
const Email         = lazy(() => import('./pages/Email'));
const References    = lazy(() => import('./pages/References'));
const Board         = lazy(() => import('./pages/Board'));
const Auth          = lazy(() => import('./pages/Auth'));
const Apply         = lazy(() => import('./pages/Apply'));
const Accounts      = lazy(() => import('./pages/Accounts'));
const AssignedTasks = lazy(() => import('./pages/AssignedTasks'));
const Backlog       = lazy(() => import('./pages/Backlog'));
const Overdue       = lazy(() => import('./pages/Overdue'));

import { AuthProvider, useAuth } from './context/AuthContext';

// Apply saved theme on initial load (before React renders)
(function initTheme() {
  const theme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;
  root.classList.remove('dark', 'theme-ocean', 'theme-dusk');
  if (theme === 'dark') root.classList.add('dark');
  localStorage.setItem('theme', theme);
})();

// Mounted only while a route chunk is in flight, so the sidebar spinner reflects real work.
function RouteFallback({ onLoading }) {
  useEffect(() => {
    onLoading(true);
    return () => onLoading(false);
  }, [onLoading]);
  return <PageSkeleton />;
}

function AppShell() {
  const { user, loading, login, logout } = useAuth();
  const [routeLoading, setRouteLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const onRouteLoading = useCallback(v => setRouteLoading(v), []);

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
        <Suspense fallback={<div className="intentional-loader"><div className="spinner-large" /></div>}>
          <Routes>
            <Route path="/apply" element={<Apply />} />
            <Route path="*" element={<Auth onLogin={login} />} />
          </Routes>
        </Suspense>
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
          <Suspense fallback={<RouteFallback onLoading={onRouteLoading} />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/assigned" element={<AssignedTasks />} />
            <Route path="/backlog" element={<Backlog />} />
            <Route path="/overdue" element={<Overdue />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/team" element={<Team />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/email" element={<Email />} />
            <Route path="/references" element={<References />} />
            <Route path="/board" element={<Board />} />
            <Route path="/accounts" element={user.role === 'admin' ? <Accounts /> : <Navigate to="/dashboard" replace />} />
            <Route path="/admin" element={user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
        </div>
        <Toast />
      </div>
      {/* Mounted only once opened: its chunk and its three data subscriptions are not
          part of what every page pays for. */}
      {searchOpen && (
        <Suspense fallback={null}>
          <SearchPalette open onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
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
