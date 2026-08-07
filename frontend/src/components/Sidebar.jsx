import { NavLink } from 'react-router-dom';

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

export default function Sidebar({ user, onLogout, routeLoading }) {
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
        <button 
          onClick={() => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
          }}
          style={{ display: 'block', marginTop: 16, padding: '6px 8px', fontSize: 11, fontWeight: 600, background: 'var(--surface2)', borderRadius: 6, color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer', width: '100%', textAlign: 'center', transition: 'all 0.2s' }}>
          Toggle Dark Mode
        </button>
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
          >
            Logout
          </button>
        )}
      </nav>

      <div className="sb-footer" style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {onLogout && (
          <button onClick={onLogout} style={{ color: '#ef4444' }}>
            Lock Access
          </button>
        )}
      </div>
    </aside>
  );
}
