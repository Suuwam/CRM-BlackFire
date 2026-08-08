import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const THEMES = [
  { id: 'light', label: 'Light', bg: '#f8f8f9', dot: '#18181b' },
  { id: 'dark',  label: 'Dark',  bg: '#111113', dot: '#f0f0f2' },
  { id: 'ocean', label: 'Ocean', bg: '#0a1628', dot: '#38bdf8' },
  { id: 'dusk',  label: 'Dusk',  bg: '#1c0a14', dot: '#fb7185' },
];

function applyTheme(themeId) {
  const root = document.documentElement;
  // Remove all theme classes
  root.classList.remove('dark', 'theme-ocean', 'theme-dusk');
  if (themeId === 'dark')  root.classList.add('dark');
  if (themeId === 'ocean') root.classList.add('theme-ocean');
  if (themeId === 'dusk')  root.classList.add('theme-dusk');
  localStorage.setItem('theme', themeId);
}

const nav = [
  { to: '/dashboard',  label: 'Dashboard' },
  { to: '/clients',    label: 'Clients' },
  { to: '/calendar',   label: 'Calendar' },
  { to: '/email',      label: 'Email' },
  { to: '/references', label: 'Links' },
];

const boardNav = [
  { to: '/board', label: 'Board' },
];

const adminNav = [
  { to: '/accounts', label: 'Accounts' },
];

export default function Sidebar({ user, onLogout, routeLoading, onSearchOpen }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // Apply theme on mount and on change
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function switchTheme(id) {
    setTheme(id);
  }

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="name">Blackfire AI</div>
        <div className="sub">Product Platform Engine</div>
        <span className="sb-badge">Engine</span>
        {user && (
          <div className="sb-user-card">
            <div className="sb-user-name">{user.name}</div>
            <div className="sb-user-meta">{user.username} · {user.role}</div>
          </div>
        )}

        {/* Theme Switcher */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text3)', marginBottom: 6 }}>Theme</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {THEMES.map(t => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => switchTheme(t.id)}
                style={{
                  width: 26, height: 26, borderRadius: '50%', padding: 0, cursor: 'pointer',
                  background: t.bg,
                  border: theme === t.id ? '2.5px solid var(--accent)' : '2px solid var(--border)',
                  boxShadow: theme === t.id ? '0 0 0 2px var(--border2)' : 'none',
                  transition: 'all 0.18s ease',
                  position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.dot }} />
              </button>
            ))}
          </div>
        </div>

        {/* Search Shortcut */}
        {onSearchOpen && (
          <button
            onClick={onSearchOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 10,
              padding: '7px 10px', fontSize: 11.5, fontWeight: 500,
              background: 'var(--surface2)', borderRadius: 7, color: 'var(--text2)',
              border: '1px solid var(--border)', cursor: 'pointer', width: '100%',
              transition: 'all 0.18s', justifyContent: 'space-between',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Search...
            </span>
            <kbd style={{ fontSize: 9.5, fontWeight: 700, background: 'var(--border)', border: '1px solid var(--border2)', borderRadius: 3, padding: '1px 5px', color: 'var(--text3)', fontFamily: 'inherit', letterSpacing: '0.2px' }}>⌘K</kbd>
          </button>
        )}
      </div>

      <nav className="sb-nav">
        <div className="sb-section">Workspace</div>
        {nav.map(n => (
          <NavLink key={n.to} to={n.to}
            className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                {n.label}
                {isActive && routeLoading && (
                  <div style={{ marginLeft: 'auto', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'authSpin 0.6s linear infinite' }} />
                )}
              </>
            )}
          </NavLink>
        ))}

        <div className="sb-section" style={{ marginTop: 12 }}>Products</div>
        {boardNav.map(n => (
          <NavLink key={n.to} to={n.to}
            className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                {n.label}
                {isActive && routeLoading && (
                  <div style={{ marginLeft: 'auto', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'authSpin 0.6s linear infinite' }} />
                )}
              </>
            )}
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <>
            <div className="sb-section" style={{ marginTop: 12 }}>Admin</div>
            {adminNav.map(n => (
              <NavLink key={n.to} to={n.to}
                className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
                {({ isActive }) => (
                  <>
                    {n.label}
                    {isActive && routeLoading && (
                      <div style={{ marginLeft: 'auto', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'authSpin 0.6s linear infinite' }} />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}

        {onLogout && (
          <button
            onClick={onLogout}
            className="sb-item sb-item-logout"
            title="Logout of session"
            style={{ marginTop: 4 }}
          >
            Logout
          </button>
        )}
      </nav>

      {/* Email Notification Bell */}
      <div className="sb-footer">
        <NotificationBell />
      </div>
    </aside>
  );
}
