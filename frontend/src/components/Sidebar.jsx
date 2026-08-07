import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher } from '../api';

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
  const [notifOpen, setNotifOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => {
    try { return parseInt(localStorage.getItem('crm_notif_seen') || '0', 10); } catch { return 0; }
  });

  const { data: activities = [] } = useSWR('/activity?days=7', fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  });

  // Count unread — activities after lastSeen timestamp
  const unread = activities.filter(a => new Date(a.createdAt).getTime() > lastSeen).length;

  function markSeen() {
    const now = Date.now();
    setLastSeen(now);
    localStorage.setItem('crm_notif_seen', String(now));
    setNotifOpen(o => !o);
  }

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

      {/* Notification Bell — bottom of sidebar */}
      <div className="sb-footer" style={{ position: 'relative' }}>
        <button
          onClick={markSeen}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
            borderRadius: 8, color: notifOpen ? 'var(--text)' : 'var(--text3)',
            fontSize: 12, width: '100%', transition: 'all 0.18s',
            background: notifOpen ? 'var(--surface2)' : 'transparent',
            border: notifOpen ? '1px solid var(--border)' : '1px solid transparent',
            fontWeight: 500, cursor: 'pointer', position: 'relative',
          }}
        >
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: -5, right: -7,
                background: '#ef4444', color: '#fff',
                fontSize: 9, fontWeight: 800,
                width: 16, height: 16, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--sidebar-bg)',
                animation: 'pulse 2s infinite',
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          <span>Notifications</span>
          {unread > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#ef444422', color: '#ef4444', borderRadius: 20, padding: '1px 7px' }}>
              {unread} new
            </span>
          )}
        </button>

        {/* Notification Dropdown */}
        {notifOpen && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, boxShadow: '0 -8px 32px rgba(0,0,0,0.14)',
            zIndex: 500, marginBottom: 6, overflow: 'hidden',
            maxHeight: 340, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Recent Activity</span>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>Last 7 days</span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {activities.length === 0 && (
                <div style={{ padding: '24px 16px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>No recent activity</div>
              )}
              {activities.slice(0, 8).map(a => {
                const isNew = new Date(a.createdAt).getTime() > lastSeen;
                return (
                  <div key={a._id} style={{
                    padding: '10px 14px', borderBottom: '1px solid var(--border)',
                    background: isNew ? 'var(--surface2)' : 'transparent',
                    transition: 'background 0.15s',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isNew && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />}
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.summary || `${a.actorName} ${a.action} ${a.targetName}`}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text3)', paddingLeft: isNew ? 12 : 0 }}>
                      {new Date(a.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
