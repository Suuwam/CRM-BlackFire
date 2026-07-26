import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Calendar from './pages/Calendar';
import Email from './pages/Email';
import References from './pages/References';
import Board from './pages/Board';
import { ToastProvider } from './components/Toast';

export default function App() {
  return (
    <ToastProvider>
      <div className="layout">
        <Sidebar />
        <div className="main">
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
