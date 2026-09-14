import { createContext, useContext, useEffect, useState } from 'react';
import { attendanceApi, authApi } from '../api';

const AuthContext = createContext(null);

function loadStoredUser() {
  try {
    const raw = sessionStorage.getItem('crm_session_user') || localStorage.getItem('crm_session_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        const stored = loadStoredUser();
        if (!stored?._id) return;
        const res = await authApi.me();
        if (!active) return;
        const nextUser = res.data.user;
        setUser(nextUser);
        sessionStorage.setItem('crm_session_user', JSON.stringify(nextUser));
        localStorage.setItem('crm_session_user', JSON.stringify(nextUser));
      } catch {
        if (!active) return;
        sessionStorage.removeItem('crm_session_user');
        localStorage.removeItem('crm_session_user');
        setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (!user?._id) {
      setLoading(false);
      return () => { active = false; };
    }

    verify();
    return () => { active = false; };
  }, []);

  // Presence heartbeat — drives the online list and keeps the clock honest.
  useEffect(() => {
    if (!user?._id) return;
    const ping = () => { attendanceApi.ping().catch(() => {}); };
    ping();
    const timer = setInterval(ping, 60000);
    const onExit = () => {
      try {
        const raw = sessionStorage.getItem('crm_session_user') || localStorage.getItem('crm_session_user');
        const id = raw ? JSON.parse(raw)?._id : null;
        if (id) fetch(`${import.meta.env?.VITE_API_URL || '/api'}/auth/exit`, {
          method: 'POST', keepalive: true, headers: { 'x-session-user': id },
        }).catch(() => {});
      } catch {}
    };
    window.addEventListener('pagehide', onExit);
    return () => { clearInterval(timer); window.removeEventListener('pagehide', onExit); };
  }, [user?._id]);

  async function login(credentials) {
    const res = await authApi.login(credentials);
    const nextUser = res.data.user;
    setUser(nextUser);
    sessionStorage.setItem('crm_session_user', JSON.stringify(nextUser));
    localStorage.setItem('crm_session_user', JSON.stringify(nextUser));
    return nextUser;
  }

  async function logout() {
    try { await authApi.logout(); } catch {}
    sessionStorage.removeItem('crm_session_user');
    localStorage.removeItem('crm_session_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}