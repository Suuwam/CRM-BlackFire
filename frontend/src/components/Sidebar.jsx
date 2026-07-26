import { NavLink } from 'react-router-dom';

const nav = [
  { to: '/dashboard',  label: 'Dashboard', icon: '📊' },
  { to: '/clients',    label: 'Clients',   icon: '👥' },
  { to: '/calendar',   label: 'Calendar',  icon: '📅' },
  { to: '/email',      label: 'Email',     icon: '✉️' },
  { to: '/references', label: 'Links',     icon: '🔗' },
];

const boardNav = [
  { to: '/board', label: 'Board', icon: '📋' },
];

export default function Sidebar({ onLogout, routeLoading }) {
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="name">Blackfire AI</div>
        <div className="sub">Product Platform Engine</div>
        <span className="sb-badge">Engine</span>
      </div>

      <nav className="sb-nav">
        <div className="sb-section">Workspace</div>
        {nav.map(n => (
          <NavLink key={n.to} to={n.to}
            className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
            {({ isActive }) => (
              <>
                <span className="ico">{n.icon}</span>
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
                <span className="ico">{n.icon}</span>
                {n.label}
                {isActive && routeLoading && (
                  <div style={{ marginLeft: 'auto', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'authSpin 0.6s linear infinite' }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sb-footer" style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <button onClick={() => window.open('https://cloud.mongodb.com', '_blank')}>
          MongoDB Atlas
        </button>
        {onLogout && (
          <button onClick={onLogout} style={{ color: '#ef4444' }}>
            Lock Access
          </button>
        )}
      </div>
    </aside>
  );
}
