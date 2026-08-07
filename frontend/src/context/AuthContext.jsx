import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

function loadStoredUser() {
  try {
    const raw = sessionStorage.getItem('crm_session_user');
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
      } catch {
        if (!active) return;
        sessionStorage.removeItem('crm_session_user');
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

  async function login(credentials) {
    const res = await authApi.login(credentials);
    const nextUser = res.data.user;
    setUser(nextUser);
    sessionStorage.setItem('crm_session_user', JSON.stringify(nextUser));
    return nextUser;
  }

  function logout() {
    sessionStorage.removeItem('crm_session_user');
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